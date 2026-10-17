import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { Router, type Request } from "express";
import { query, withTransaction } from "./db";
import { requireAdmin, requireUser } from "./auth";
import { ApiError } from "./errors";

const validStatuses = new Set([
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

function cleanPhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function validateOrderContact(body: Record<string, unknown>, fallback: Request["appUser"]) {
  const fullName = String(body.fullName || fallback?.fullName || "").trim();
  const phone = cleanPhone(body.phone || fallback?.phone);
  const whatsappPhone = cleanPhone(body.whatsappPhone || fallback?.whatsappPhone);
  const governorate = String(body.governorate || fallback?.governorate || "").trim();
  const city = String(body.city || fallback?.city || "").trim();
  const address = String(body.address || fallback?.address || "").trim();
  const landmark = String(body.landmark || fallback?.landmark || "").trim();
  const notes = String(body.notes || "").trim();

  if (fullName.length < 2 || fullName.length > 120) throw new ApiError(400, "اكتب الاسم بطول صحيح.");
  if (!/^01[0125]\d{8}$/.test(phone)) throw new ApiError(400, "رقم الهاتف المصري غير صحيح.");
  if (whatsappPhone && !/^01[0125]\d{8}$/.test(whatsappPhone)) {
    throw new ApiError(400, "رقم واتساب المصري غير صحيح.");
  }
  if (!governorate || governorate.length > 100) throw new ApiError(400, "اختر المحافظة.");
  if (city.length < 2 || city.length > 120) throw new ApiError(400, "اكتب المنطقة أو المدينة.");
  if (address.length < 5 || address.length > 240) throw new ApiError(400, "اكتب العنوان بالتفصيل.");
  if (landmark.length > 160 || notes.length > 500) throw new ApiError(400, "العنوان أو الملاحظات أطول من المسموح.");

  return { fullName, phone, whatsappPhone, governorate, city, address, landmark, notes };
}

async function getOrders(where = "", values: unknown[] = []) {
  const orders = await query(
    `SELECT o.*, u.email AS customer_email
     FROM store_orders o
     JOIN store_users u ON u.clerk_user_id = o.user_id
     ${where}
     ORDER BY o.created_at DESC LIMIT 200`,
    values,
  );
  if (!orders.rowCount) return [];
  const ids = orders.rows.map((order) => order.id);
  const items = await query(
    `SELECT id, order_id, product_id, product_name, variant_id, variant_name, package_size,
            unit_price, quantity, line_total
     FROM store_order_items
     WHERE order_id = ANY($1::uuid[])
     ORDER BY product_name`,
    [ids],
  );
  const itemsByOrder = new Map<string, Record<string, any>[]>();
  for (const item of items.rows) {
    const list = itemsByOrder.get(item.order_id) || [];
    list.push({
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id || "",
      variantName: item.variant_name || "",
      nameAr: item.product_name,
      packageSize: item.package_size,
      unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity),
      lineTotal: Number(item.line_total),
    });
    itemsByOrder.set(item.order_id, list);
  }

  return orders.rows.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    phone: order.phone,
    whatsappPhone: order.whatsapp_phone,
    governorate: order.governorate,
    city: order.city,
    address: order.address,
    landmark: order.landmark,
    notes: order.notes,
    status: order.status,
    fulfillmentMethod: order.fulfillment_method,
    paymentMethod: order.payment_method,
    subtotal: Number(order.subtotal),
    deliveryFee: order.delivery_fee === null ? null : Number(order.delivery_fee),
    total: Number(order.total),
    createdAt: order.created_at,
    items: itemsByOrder.get(order.id) || [],
  }));
}

async function restoreOrderInventory(client: PoolClient, orderId: string) {
  await client.query(
    `UPDATE store_products p SET stock_quantity = p.stock_quantity + i.quantity,
      updated_at = NOW()
     FROM store_order_items i
     WHERE i.order_id = $1 AND p.id = i.product_id`,
    [orderId],
  );
  await client.query(
    `WITH restores AS (
       SELECT product_id, variant_id, SUM(quantity)::int AS quantity
       FROM store_order_items
       WHERE order_id = $1 AND variant_id <> ''
       GROUP BY product_id, variant_id
     )
     UPDATE store_products p SET
       variants = (
         SELECT COALESCE(jsonb_agg(
           CASE WHEN restores.quantity IS NULL THEN variant
             ELSE jsonb_set(variant, '{stockQuantity}',
               to_jsonb((variant->>'stockQuantity')::int + restores.quantity), false)
           END ORDER BY ordinal
         ), '[]'::jsonb)
         FROM jsonb_array_elements(p.variants) WITH ORDINALITY AS entries(variant, ordinal)
         LEFT JOIN restores ON restores.product_id = p.id
           AND restores.variant_id = entries.variant->>'id'
       ),
       updated_at = NOW()
     WHERE EXISTS (SELECT 1 FROM restores WHERE restores.product_id = p.id)`,
    [orderId],
  );
}

export const ordersRouter = Router();

ordersRouter.post("/orders", requireUser, async (req: Request, res, next) => {
  const sourceItems = req.body?.items;
  if (!Array.isArray(sourceItems) || sourceItems.length < 1 || sourceItems.length > 30) {
    res.status(400).json({ error: "السلة فارغة أو تحتوي على عدد أصناف غير مسموح." });
    return;
  }
  const quantities = new Map<string, { productId: string; variantId: string; quantity: number }>();
  for (const item of sourceItems) {
    const productId = String(item?.productId || "").trim();
    const variantId = String(item?.variantId || "").trim();
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      res.status(400).json({ error: "بيانات أحد أصناف الطلب غير صحيحة." });
      return;
    }
    const key = `${productId}\u0000${variantId}`;
    const current = quantities.get(key);
    quantities.set(key, { productId, variantId, quantity: (current?.quantity || 0) + quantity });
  }
  const contact = validateOrderContact(req.body || {}, req.appUser);

  try {
    const order = await withTransaction(async (client) => {
      const orderId = randomUUID();
      const orderNumber = `ABU-${randomUUID().slice(0, 8).toUpperCase()}`;
      const resolvedItems = [];
      let subtotal = 0;

      for (const { productId, variantId, quantity } of quantities.values()) {
        const found = await client.query(
          `SELECT id, name_ar, package_size, price, stock_quantity, variants,
                  is_available, is_demo, is_active
           FROM store_products WHERE id = $1 FOR UPDATE`,
          [productId],
        );
        if (!found.rowCount) throw new ApiError(409, "أحد المنتجات لم يعد موجودًا في المتجر.");
        const product = found.rows[0];
        const productVariants = Array.isArray(product.variants) ? product.variants : [];
        let selectedVariant: Record<string, any> | null = null;
        if (variantId) {
          selectedVariant = productVariants.find(
            (variant: Record<string, any>) => variant.id === variantId && variant.isAvailable !== false,
          ) || null;
          if (!selectedVariant) throw new ApiError(409, `الخيار المطلوب من ${product.name_ar} لم يعد متاحًا.`);
        } else if (productVariants.length) {
          throw new ApiError(409, `اختر نوع العبوة المطلوب من ${product.name_ar}.`);
        }
        if (product.is_demo) {
          throw new ApiError(409, "بعض الأصناف ما زالت بيانات تجريبية؛ لن يتم تسجيل طلب بسعر أو مخزون غير مؤكد.", "DEMO_PRODUCT");
        }
        if (!product.is_active || !product.is_available) {
          throw new ApiError(409, `المنتج ${product.name_ar} غير متاح حاليًا.`);
        }
        const availableQuantity = selectedVariant ? Number(selectedVariant.stockQuantity) : Number(product.stock_quantity);
        if (availableQuantity < quantity) {
          throw new ApiError(409, `الكمية المتاحة من ${product.name_ar} أقل من المطلوب.`);
        }
        const unitPrice = Number(selectedVariant ? selectedVariant.price : product.price);
        const lineTotal = unitPrice * quantity;
        subtotal += lineTotal;
        resolvedItems.push({
          ...product,
          variantId,
          variantName: selectedVariant?.nameAr || "",
          package_size: selectedVariant?.packageSize || product.package_size,
          quantity,
          unitPrice,
          lineTotal,
        });
      }

      for (const item of resolvedItems) {
        if (item.variantId) {
          await client.query(
            `UPDATE store_products
             SET stock_quantity = GREATEST(stock_quantity - $1, 0),
                 variants = (
                   SELECT COALESCE(jsonb_agg(
                     CASE WHEN variant->>'id' = $2
                       THEN jsonb_set(variant, '{stockQuantity}',
                         to_jsonb(GREATEST((variant->>'stockQuantity')::int - $1, 0)), false)
                       ELSE variant
                     END ORDER BY ordinal
                   ), '[]'::jsonb)
                   FROM jsonb_array_elements(variants) WITH ORDINALITY AS entries(variant, ordinal)
                 ),
                 updated_at = NOW()
             WHERE id = $3`,
            [item.quantity, item.variantId, item.id],
          );
        } else {
          await client.query(
            "UPDATE store_products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2",
            [item.quantity, item.id],
          );
        }
      }

      await client.query(
        `INSERT INTO store_orders (
          id, order_number, user_id, customer_name, phone, whatsapp_phone,
          governorate, city, address, landmark, notes, status,
          fulfillment_method, payment_method, subtotal, delivery_fee, total
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending','delivery','cash_on_delivery',$12,NULL,$12)`,
        [
          orderId,
          orderNumber,
          req.appUser!.clerkUserId,
          contact.fullName,
          contact.phone,
          contact.whatsappPhone,
          contact.governorate,
          contact.city,
          contact.address,
          contact.landmark,
          contact.notes,
          subtotal,
        ],
      );

      for (const item of resolvedItems) {
        await client.query(
          `INSERT INTO store_order_items (
            id, order_id, product_id, product_name, variant_id, variant_name, package_size,
            unit_price, quantity, line_total
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            randomUUID(),
            orderId,
            item.id,
            item.name_ar,
            item.variantId,
            item.variantName,
            item.package_size,
            item.unitPrice,
            item.quantity,
            item.lineTotal,
          ],
        );
      }

      await client.query(
        `UPDATE store_users SET full_name=$1, phone=$2, whatsapp_phone=$3,
         governorate=$4, city=$5, address=$6, landmark=$7, updated_at=NOW()
         WHERE clerk_user_id=$8`,
        [
          contact.fullName,
          contact.phone,
          contact.whatsappPhone,
          contact.governorate,
          contact.city,
          contact.address,
          contact.landmark,
          req.appUser!.clerkUserId,
        ],
      );

      return { id: orderId, orderNumber, subtotal, total: subtotal, deliveryFee: null };
    });
    res.status(201).json({ order });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get("/orders", requireUser, async (req, res, next) => {
  try {
    const orders = await getOrders("WHERE o.user_id = $1", [req.appUser!.clerkUserId]);
    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

ordersRouter.patch("/orders/:orderId/cancel", requireUser, async (req, res, next) => {
  try {
    const updated = await withTransaction(async (client) => {
      const found = await client.query(
        "SELECT id, status FROM store_orders WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [req.params.orderId, req.appUser!.clerkUserId],
      );
      if (!found.rowCount) throw new ApiError(404, "الطلب غير موجود.");
      if (found.rows[0].status !== "pending") {
        throw new ApiError(409, "لا يمكن إلغاء الطلب بعد أن يبدأ المتجر تجهيزه.");
      }
      await restoreOrderInventory(client, String(req.params.orderId));
      await client.query(
        "UPDATE store_orders SET status='cancelled', updated_at=NOW() WHERE id=$1",
        [req.params.orderId],
      );
      return { id: req.params.orderId, status: "cancelled" };
    });
    res.json({ order: updated });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get("/admin/orders", requireUser, requireAdmin, async (req, res, next) => {
  const status = String(req.query.status || "");
  if (status && !validStatuses.has(status)) {
    res.status(400).json({ error: "فلتر حالة الطلب غير صحيح." });
    return;
  }
  try {
    const orders = await getOrders(status ? "WHERE o.status = $1" : "", status ? [status] : []);
    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

ordersRouter.patch(
  "/admin/orders/:orderId/status",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    const status = String(req.body?.status || "");
    if (!validStatuses.has(status)) {
      res.status(400).json({ error: "حالة الطلب غير صحيحة." });
      return;
    }
    try {
      const updated = await withTransaction(async (client) => {
        const found = await client.query(
          "SELECT id, status FROM store_orders WHERE id = $1 FOR UPDATE",
          [req.params.orderId],
        );
        if (!found.rowCount) throw new ApiError(404, "الطلب غير موجود.");
        const previousStatus = String(found.rows[0].status);
        if (previousStatus === "cancelled" && status !== "cancelled") {
          throw new ApiError(409, "الطلب الملغي لا يمكن إعادته إلى دورة التجهيز.");
        }
        if (previousStatus === "delivered" && status !== "delivered") {
          throw new ApiError(409, "الطلب الذي تم تسليمه لا يمكن تغيير حالته.");
        }
        if (status === "cancelled" && previousStatus !== "cancelled") {
          await restoreOrderInventory(client, String(req.params.orderId));
        }
        await client.query(
          "UPDATE store_orders SET status=$1, updated_at=NOW() WHERE id=$2",
          [status, req.params.orderId],
        );
        return { id: req.params.orderId, status };
      });
      res.json({ order: updated });
    } catch (error) {
      next(error);
    }
  },
);

