import { randomUUID } from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";
import { query } from "./db";
import { requireAdmin, requireUser } from "./auth";
import { ApiError } from "./errors";
import { deleteProductMediaObjects } from "./media";

function asText(value: unknown, field: string, maxLength: number, required = false) {
  const result = String(value ?? "").trim();
  if (required && !result) throw new ApiError(400, `حقل ${field} مطلوب.`);
  if (result.length > maxLength) throw new ApiError(400, `حقل ${field} أطول من المسموح.`);
  return result;
}

function asNumber(value: unknown, field: string, options: { integer?: boolean; max?: number } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (options.max !== undefined && number > options.max)) {
    throw new ApiError(400, `قيمة ${field} غير صحيحة.`);
  }
  if (options.integer && !Number.isInteger(number)) {
    throw new ApiError(400, `قيمة ${field} يجب أن تكون رقمًا صحيحًا.`);
  }
  return number;
}

function mapCategory(row: Record<string, any>) {
  return {
    id: row.id,
    nameAr: row.name_ar,
    icon: row.icon,
    slug: row.id,
    sortOrder: row.sort_order,
  };
}

async function getCategories() {
  const result = await query(
    "SELECT id, name_ar, icon, sort_order FROM store_categories ORDER BY sort_order, name_ar",
  );
  return result.rows.map(mapCategory);
}

async function getProducts(includeInactive = false) {
  const result = await query(
    `SELECT p.*, c.name_ar AS category_name_ar
     FROM store_products p
     JOIN store_categories c ON c.id = p.category_id
     ${includeInactive ? "" : "WHERE p.is_active = TRUE"}
     ORDER BY p.is_featured DESC, p.created_at DESC`,
  );
  if (!result.rowCount) return [];

  const ids = result.rows.map((row) => row.id);
  const mediaResult = await query(
    `SELECT id, product_id, media_type, mime_type, original_name, sort_order, created_at
     FROM product_media WHERE product_id = ANY($1::text[]) ORDER BY sort_order, created_at`,
    [ids],
  );
  const mediaByProduct = new Map<string, Record<string, any>[]>();
  for (const row of mediaResult.rows) {
    const list = mediaByProduct.get(row.product_id) || [];
    list.push({
      id: row.id,
      mediaType: row.media_type,
      mimeType: row.mime_type,
      originalName: row.original_name,
      sortOrder: row.sort_order,
      url: `/api/media/${row.id}`,
    });
    mediaByProduct.set(row.product_id, list);
  }

  return result.rows.map((row) => {
    const media = mediaByProduct.get(row.id) || [];
    const images = media.filter((item) => item.mediaType === "image");
    const videos = media.filter((item) => item.mediaType === "video");
    const legacyImage = row.image_url || "";
    return {
      id: row.id,
      slug: row.slug,
      nameAr: row.name_ar,
      brand: row.brand,
      categoryId: row.category_id,
      categoryNameAr: row.category_name_ar,
      subcategoryAr: row.subcategory_ar,
      shortDescription: row.short_description,
      fullDescription: row.full_description,
      image: images[0]?.url || legacyImage,
      gallery: images.map((item) => item.url).length ? images.map((item) => item.url) : legacyImage ? [legacyImage] : [],
      videos,
      media,
      variants: Array.isArray(row.variants) ? row.variants : [],
      unit: row.unit,
      packageSize: row.package_size,
      price: Number(row.price),
      originalPrice: row.original_price === null ? Number(row.price) : Number(row.original_price),
      discountPercentage: Number(row.discount_percentage),
      offerDescription: row.offer_description,
      stockQuantity: Number(row.stock_quantity),
      isAvailable: Boolean(row.is_available) && Number(row.stock_quantity) > 0,
      isFeatured: Boolean(row.is_featured),
      isBestSeller: Boolean(row.is_best_seller),
      isVariableWeight: Boolean(row.is_variable_weight),
      isDemo: Boolean(row.is_demo),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    };
  });
}

interface ProductInput {
  nameAr: string;
  brand: string;
  categoryId: string;
  subcategoryAr: string;
  shortDescription: string;
  fullDescription: string;
  unit: string;
  packageSize: string;
  price: number;
  originalPrice: number | null;
  discountPercentage: number;
  offerDescription: string;
  stockQuantity: number;
  variants: Array<{
    id: string;
    nameAr: string;
    packageSize: string;
    price: number;
    originalPrice: number | null;
    stockQuantity: number;
    isAvailable: boolean;
  }>;
  isAvailable: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isVariableWeight: boolean;
  isDemo: boolean;
  isActive: boolean;
}

function parseProductInput(body: Record<string, unknown>): ProductInput {
  const sourceVariants = body.variants === undefined ? [] : body.variants;
  if (!Array.isArray(sourceVariants) || sourceVariants.length > 20) {
    throw new ApiError(400, "أضف حتى 20 خيارًا مختلفًا للمنتج.");
  }
  const seenVariantIds = new Set<string>();
  const variants = sourceVariants.map((source, index) => {
    const variant = source as Record<string, unknown>;
    const id = asText(variant.id, `معرّف الخيار ${index + 1}`, 80) || randomUUID();
    if (seenVariantIds.has(id)) throw new ApiError(400, "معرّفات خيارات المنتج يجب أن تكون مختلفة.");
    seenVariantIds.add(id);
    return {
      id,
      nameAr: asText(variant.nameAr, "اسم الخيار", 100, true),
      packageSize: asText(variant.packageSize, "حجم الخيار", 100, true),
      price: asNumber(variant.price, "سعر الخيار"),
      originalPrice:
        variant.originalPrice === "" || variant.originalPrice === null || variant.originalPrice === undefined
          ? null
          : asNumber(variant.originalPrice, "السعر السابق للخيار"),
      stockQuantity: asNumber(variant.stockQuantity, "مخزون الخيار", { integer: true, max: 100000 }),
      isAvailable: variant.isAvailable !== false,
    };
  });
  const totalVariantStock = variants.reduce((sum, variant) => sum + variant.stockQuantity, 0);
  if (totalVariantStock > 100000) throw new ApiError(400, "إجمالي مخزون الخيارات أكبر من المسموح.");

  return {
    nameAr: asText(body.nameAr, "اسم المنتج", 160, true),
    brand: asText(body.brand, "العلامة التجارية", 120),
    categoryId: asText(body.categoryId, "القسم", 80, true),
    subcategoryAr: asText(body.subcategoryAr, "نوع المنتج", 100),
    shortDescription: asText(body.shortDescription, "الوصف المختصر", 300),
    fullDescription: asText(body.fullDescription, "الوصف", 3000),
    unit: asText(body.unit, "وحدة البيع", 40, true),
    packageSize: asText(body.packageSize, "حجم العبوة", 100, true),
    price: asNumber(body.price, "السعر"),
    originalPrice:
      body.originalPrice === "" || body.originalPrice === null || body.originalPrice === undefined
        ? null
        : asNumber(body.originalPrice, "السعر السابق"),
    discountPercentage: asNumber(body.discountPercentage ?? 0, "نسبة الخصم", { max: 100 }),
    offerDescription: asText(body.offerDescription, "وصف العرض", 150),
    stockQuantity: variants.length
      ? totalVariantStock
      : asNumber(body.stockQuantity, "الكمية", { integer: true, max: 100000 }),
    variants,
    isAvailable: body.isAvailable !== false,
    isFeatured: body.isFeatured === true,
    isBestSeller: body.isBestSeller === true,
    isVariableWeight: body.isVariableWeight === true,
    isDemo: body.isDemo === true,
    isActive: body.isActive !== false,
  };
}

async function validateCategory(categoryId: string) {
  const result = await query("SELECT id FROM store_categories WHERE id = $1", [categoryId]);
  if (!result.rowCount) throw new ApiError(400, "القسم المحدد غير موجود.");
}

async function fetchAdminProduct(id: string) {
  const products = await getProducts(true);
  return products.find((product) => product.id === id);
}

export const catalogRouter = Router();

catalogRouter.get("/catalog", async (_req, res, next) => {
  try {
    const [categories, products] = await Promise.all([getCategories(), getProducts()]);
    res.json({ categories, products });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/admin/categories", requireUser, requireAdmin, async (_req, res, next) => {
  try {
    res.json({ categories: await getCategories() });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/admin/categories", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const nameAr = asText(req.body?.nameAr, "اسم القسم", 100, true);
    const icon = asText(req.body?.icon || "Store", "الأيقونة", 40) || "Store";
    const id = randomUUID();
    const orderResult = await query("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM store_categories");
    const inserted = await query(
      `INSERT INTO store_categories (id, name_ar, icon, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING id, name_ar, icon, sort_order`,
      [id, nameAr, icon, orderResult.rows[0].next],
    );
    res.status(201).json({ category: mapCategory(inserted.rows[0]) });
  } catch (error) {
    next(error);
  }
});

catalogRouter.patch("/admin/categories/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const nameAr = asText(req.body?.nameAr, "اسم القسم", 100, true);
    const icon = asText(req.body?.icon || "Store", "الأيقونة", 40) || "Store";
    const updated = await query(
      `UPDATE store_categories SET name_ar = $1, icon = $2, updated_at = NOW()
       WHERE id = $3 RETURNING id, name_ar, icon, sort_order`,
      [nameAr, icon, req.params.id],
    );
    if (!updated.rowCount) throw new ApiError(404, "القسم غير موجود.");
    res.json({ category: mapCategory(updated.rows[0]) });
  } catch (error) {
    next(error);
  }
});

catalogRouter.delete("/admin/categories/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const used = await query("SELECT COUNT(*)::int AS count FROM store_products WHERE category_id = $1", [req.params.id]);
    if (Number(used.rows[0].count) > 0) {
      throw new ApiError(409, "انقل المنتجات أو احذفها قبل حذف هذا القسم.");
    }
    const deleted = await query("DELETE FROM store_categories WHERE id = $1 RETURNING id", [req.params.id]);
    if (!deleted.rowCount) throw new ApiError(404, "القسم غير موجود.");
    res.json({ message: "تم حذف القسم." });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/admin/products", requireUser, requireAdmin, async (_req, res, next) => {
  try {
    res.json({ products: await getProducts(true) });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/admin/products", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const product = parseProductInput(req.body || {});
    await validateCategory(product.categoryId);
    const id = randomUUID();
    const slug = `product-${id.slice(0, 8)}`;
    await query(
      `INSERT INTO store_products (
        id, slug, name_ar, brand, category_id, subcategory_ar, short_description,
        full_description, unit, package_size, price, original_price,
        discount_percentage, offer_description, stock_quantity, is_available,
        is_featured, is_best_seller, is_variable_weight, is_demo, is_active, variants
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      )`,
      [
        id, slug, product.nameAr, product.brand, product.categoryId, product.subcategoryAr,
        product.shortDescription, product.fullDescription, product.unit, product.packageSize,
        product.price, product.originalPrice, product.discountPercentage, product.offerDescription,
        product.stockQuantity, product.isAvailable, product.isFeatured, product.isBestSeller,
        product.isVariableWeight, product.isDemo, product.isActive, JSON.stringify(product.variants),
      ],
    );
    res.status(201).json({ product: await fetchAdminProduct(id) });
  } catch (error) {
    next(error);
  }
});

catalogRouter.patch("/admin/products/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const product = parseProductInput(req.body || {});
    await validateCategory(product.categoryId);
    const updated = await query(
      `UPDATE store_products SET
        name_ar=$1, brand=$2, category_id=$3, subcategory_ar=$4,
        short_description=$5, full_description=$6, unit=$7, package_size=$8,
        price=$9, original_price=$10, discount_percentage=$11, offer_description=$12,
        stock_quantity=$13, is_available=$14, is_featured=$15, is_best_seller=$16,
        is_variable_weight=$17, is_demo=$18, is_active=$19, variants=$20::jsonb, updated_at=NOW()
       WHERE id=$21 RETURNING id`,
      [
        product.nameAr, product.brand, product.categoryId, product.subcategoryAr,
        product.shortDescription, product.fullDescription, product.unit, product.packageSize,
        product.price, product.originalPrice, product.discountPercentage, product.offerDescription,
        product.stockQuantity, product.isAvailable, product.isFeatured, product.isBestSeller,
        product.isVariableWeight, product.isDemo, product.isActive, JSON.stringify(product.variants), req.params.id,
      ],
    );
    if (!updated.rowCount) throw new ApiError(404, "المنتج غير موجود.");
    res.json({ product: await fetchAdminProduct(String(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

catalogRouter.delete("/admin/products/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    await deleteProductMediaObjects(String(req.params.id));
    const deleted = await query("DELETE FROM store_products WHERE id = $1 RETURNING id", [req.params.id]);
    if (!deleted.rowCount) throw new ApiError(404, "المنتج غير موجود.");
    res.json({ message: "تم حذف المنتج." });
  } catch (error) {
    next(error);
  }
});

