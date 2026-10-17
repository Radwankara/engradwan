// server/index.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";

// server/auth.ts
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { clerkClient, getAuth } from "@clerk/express";

// server/db.ts
import { Pool } from "pg";
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to start the supermarket server.");
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function query(text, values = []) {
  return pool.query(text, values);
}
async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// server/errors.ts
var ApiError = class extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
  status;
  code;
};

// server/auth.ts
var mapUser = (row) => ({
  clerkUserId: String(row.clerk_user_id),
  email: String(row.email),
  fullName: String(row.full_name || ""),
  phone: String(row.phone || ""),
  whatsappPhone: String(row.whatsapp_phone || ""),
  governorate: String(row.governorate || ""),
  city: String(row.city || ""),
  address: String(row.address || ""),
  landmark: String(row.landmark || ""),
  role: row.role === "admin" ? "admin" : "customer",
  createdAt: new Date(String(row.created_at)).toISOString()
});
async function getOrCreateAppUser(clerkUserId) {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (email2) => email2.id === clerkUser.primaryEmailAddressId
  );
  if (!primaryEmail?.emailAddress || primaryEmail.verification?.status !== "verified") {
    throw new ApiError(403, "\u064A\u062C\u0628 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0642\u0628\u0644 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0645\u062A\u062C\u0631.", "EMAIL_NOT_VERIFIED");
  }
  const email = primaryEmail.emailAddress.trim().toLowerCase();
  const pendingInvite = await query(
    "SELECT id FROM admin_invites WHERE email = $1 AND accepted_at IS NULL",
    [email]
  );
  const isBootstrapAdmin = email === (process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
  const role = isBootstrapAdmin || pendingInvite.rowCount ? "admin" : "customer";
  const clerkName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim();
  const inserted = await query(
    `INSERT INTO store_users (clerk_user_id, email, full_name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (clerk_user_id) DO UPDATE SET
       email = EXCLUDED.email,
       role = CASE WHEN store_users.role = 'admin' OR EXCLUDED.role = 'admin'
                   THEN 'admin' ELSE 'customer' END,
       updated_at = NOW()
     RETURNING *`,
    [clerkUserId, email, clerkName, role]
  );
  if (pendingInvite.rowCount) {
    await query(
      `UPDATE admin_invites
       SET accepted_by = $1, accepted_at = NOW()
       WHERE email = $2 AND accepted_at IS NULL`,
      [clerkUserId, email]
    );
  }
  return mapUser(inserted.rows[0]);
}
var requireUser = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629.", code: "AUTH_REQUIRED" });
    return;
  }
  try {
    req.appUser = await getOrCreateAppUser(userId);
    next();
  } catch (error) {
    next(error);
  }
};
var requireAdmin = (req, res, next) => {
  if (!req.appUser) {
    res.status(401).json({ error: "\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629.", code: "AUTH_REQUIRED" });
    return;
  }
  if (req.appUser.role !== "admin") {
    res.status(403).json({ error: "\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u062F\u064A \u0645\u062A\u0627\u062D\u0629 \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u062A\u062C\u0631 \u0641\u0642\u0637.", code: "ADMIN_REQUIRED" });
    return;
  }
  next();
};
var authRouter = Router();
authRouter.get("/me", requireUser, (req, res) => {
  res.json({ user: req.appUser });
});
authRouter.patch("/me", requireUser, async (req, res, next) => {
  const body = req.body || {};
  const fullName = String(body.fullName || "").trim();
  const phone = String(body.phone || "").replace(/\D/g, "");
  const whatsappPhone = String(body.whatsappPhone || "").replace(/\D/g, "");
  const governorate = String(body.governorate || "").trim();
  const city = String(body.city || "").trim();
  const address = String(body.address || "").trim();
  const landmark = String(body.landmark || "").trim();
  if (fullName.length < 2 || fullName.length > 120) {
    res.status(400).json({ error: "\u0627\u0643\u062A\u0628 \u0627\u0644\u0627\u0633\u0645 \u0628\u0637\u0648\u0644 \u0635\u062D\u064A\u062D." });
    return;
  }
  if (phone && !/^01[0125]\d{8}$/.test(phone)) {
    res.status(400).json({ error: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0627\u0644\u0645\u0635\u0631\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
    return;
  }
  if (whatsappPhone && !/^01[0125]\d{8}$/.test(whatsappPhone)) {
    res.status(400).json({ error: "\u0631\u0642\u0645 \u0648\u0627\u062A\u0633\u0627\u0628 \u0627\u0644\u0645\u0635\u0631\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
    return;
  }
  if ([governorate, city, address, landmark].some((value) => value.length > 240)) {
    res.status(400).json({ error: "\u0628\u0639\u0636 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0623\u0637\u0648\u0644 \u0645\u0646 \u0627\u0644\u0645\u0633\u0645\u0648\u062D." });
    return;
  }
  try {
    const result = await query(
      `UPDATE store_users
       SET full_name = $1, phone = $2, whatsapp_phone = $3, governorate = $4,
           city = $5, address = $6, landmark = $7, updated_at = NOW()
       WHERE clerk_user_id = $8
       RETURNING *`,
      [
        fullName,
        phone,
        whatsappPhone,
        governorate,
        city,
        address,
        landmark,
        req.appUser.clerkUserId
      ]
    );
    res.json({ user: mapUser(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});
authRouter.get("/admin/admins", requireUser, requireAdmin, async (_req, res, next) => {
  try {
    const [admins, invites] = await Promise.all([
      query(
        `SELECT clerk_user_id, email, full_name, created_at
         FROM store_users WHERE role = 'admin' ORDER BY created_at`
      ),
      query(
        `SELECT id, email, created_at
         FROM admin_invites WHERE accepted_at IS NULL ORDER BY created_at DESC`
      )
    ]);
    res.json({
      admins: admins.rows.map((row) => ({
        clerkUserId: row.clerk_user_id,
        email: row.email,
        fullName: row.full_name,
        createdAt: row.created_at
      })),
      invites: invites.rows.map((row) => ({
        id: row.id,
        email: row.email,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
});
authRouter.post("/admin/admins", requireUser, requireAdmin, async (req, res, next) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    res.status(400).json({ error: "\u0627\u0643\u062A\u0628 \u0628\u0631\u064A\u062F\u064B\u0627 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u064B\u0627 \u0635\u062D\u064A\u062D\u064B\u0627." });
    return;
  }
  if (email === req.appUser.email) {
    res.status(400).json({ error: "\u062D\u0633\u0627\u0628\u0643 \u0628\u0627\u0644\u0641\u0639\u0644 \u0645\u062F\u064A\u0631." });
    return;
  }
  try {
    const existingUser = await query(
      "SELECT clerk_user_id FROM store_users WHERE email = $1",
      [email]
    );
    if (existingUser.rowCount) {
      await query(
        "UPDATE store_users SET role = 'admin', updated_at = NOW() WHERE clerk_user_id = $1",
        [existingUser.rows[0].clerk_user_id]
      );
      res.json({ message: "\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0643\u0645\u062F\u064A\u0631.", activated: true });
      return;
    }
    await query(
      `INSERT INTO admin_invites (id, email, invited_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET invited_by = EXCLUDED.invited_by, accepted_by = NULL, accepted_at = NULL`,
      [randomUUID(), email, req.appUser.clerkUserId]
    );
    res.status(201).json({
      message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u0639\u0648\u0629. \u064A\u0643\u062A\u0633\u0628 \u0627\u0644\u062D\u0633\u0627\u0628 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u062F\u064A\u0631 \u0628\u0639\u062F \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0648\u062A\u0623\u0643\u064A\u062F\u0647.",
      activated: false,
      signUpPath: "/sign-up"
    });
  } catch (error) {
    next(error);
  }
});
authRouter.delete(
  "/admin/admins/:clerkUserId",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    const targetId = String(req.params.clerkUserId);
    if (targetId === req.appUser.clerkUserId) {
      res.status(400).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0632\u0627\u0644\u0629 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0633\u0627\u0628\u0643 \u0645\u0646 \u0647\u0646\u0627." });
      return;
    }
    try {
      const result = await query(
        "SELECT COUNT(*)::int AS count FROM store_users WHERE role = 'admin'"
      );
      if (Number(result.rows[0].count) <= 1) {
        res.status(409).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0632\u0627\u0644\u0629 \u0622\u062E\u0631 \u0645\u062F\u064A\u0631 \u0641\u064A \u0627\u0644\u0645\u062A\u062C\u0631." });
        return;
      }
      const updated = await query(
        `UPDATE store_users SET role = 'customer', updated_at = NOW()
         WHERE clerk_user_id = $1 AND role = 'admin' RETURNING clerk_user_id`,
        [targetId]
      );
      if (!updated.rowCount) {
        res.status(404).json({ error: "\u0627\u0644\u0645\u062F\u064A\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
        return;
      }
      res.json({ message: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u062F\u064A\u0631." });
    } catch (error) {
      next(error);
    }
  }
);
authRouter.delete(
  "/admin/admin-invites/:inviteId",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const deleted = await query(
        "DELETE FROM admin_invites WHERE id = $1 AND accepted_at IS NULL RETURNING id",
        [req.params.inviteId]
      );
      if (!deleted.rowCount) {
        res.status(404).json({ error: "\u0627\u0644\u062F\u0639\u0648\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u062A\u0645 \u0642\u0628\u0648\u0644\u0647\u0627." });
        return;
      }
      res.json({ message: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062F\u0639\u0648\u0629." });
    } catch (error) {
      next(error);
    }
  }
);

// server/catalog.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import { Router as Router3 } from "express";

// server/media.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { basename } from "node:path";
import { Client as ReplitObjectStorageClient } from "@replit/object-storage";
import { fileTypeFromBuffer } from "file-type";
import { Router as Router2 } from "express";
import multer from "multer";
var storageClient = null;
var uploader = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 30 * 1024 * 1024 }
});
var supportedImageTypes = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
var supportedVideoTypes = /* @__PURE__ */ new Set(["video/mp4", "video/webm", "video/quicktime"]);
var storageSetupMessage = "\u0645\u0633\u0627\u062D\u0629 \u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u063A\u064A\u0631 \u0645\u0641\u0639\u0651\u0644\u0629. \u0627\u0641\u062A\u062D App Storage \u0641\u064A Replit \u0648\u0623\u0646\u0634\u0626 \u0623\u0648 \u0627\u062E\u062A\u0631 \u0645\u0633\u0627\u062D\u0629 \u062A\u062E\u0632\u064A\u0646 \u0644\u0644\u0645\u062A\u062C\u0631.";
function getStorageClient() {
  const bucketId = process.env.APP_STORAGE_BUCKET_ID?.trim();
  storageClient ??= new ReplitObjectStorageClient(bucketId ? { bucketId } : void 0);
  return storageClient;
}
async function withStorage(operation) {
  try {
    return await operation(getStorageClient());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/bucket name is needed|default bucket|failed to fetch default bucket/i.test(message)) {
      throw new ApiError(503, storageSetupMessage);
    }
    throw error;
  }
}
async function deleteProductMediaObjects(productId) {
  const media = await query(
    "SELECT id, storage_key FROM product_media WHERE product_id = $1",
    [productId]
  );
  for (const item of media.rows) {
    const result = await withStorage(
      (client) => client.delete(item.storage_key, { ignoreNotFound: true })
    );
    if (!result.ok) {
      throw new ApiError(502, "\u062A\u0639\u0630\u0631 \u062D\u0630\u0641 \u0645\u0644\u0641 \u0645\u0646 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u062A\u062E\u0632\u064A\u0646\u061B \u0644\u0645 \u064A\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0646\u062A\u062C.");
    }
  }
}
async function deleteMediaObject(mediaId) {
  const media = await query(
    "SELECT id, storage_key FROM product_media WHERE id = $1",
    [mediaId]
  );
  if (!media.rowCount) throw new ApiError(404, "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
  const result = await withStorage(
    (client) => client.delete(media.rows[0].storage_key, { ignoreNotFound: true })
  );
  if (!result.ok) throw new ApiError(502, "\u062A\u0639\u0630\u0631 \u062D\u0630\u0641 \u0627\u0644\u0645\u0644\u0641 \u0645\u0646 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
  await query("DELETE FROM product_media WHERE id = $1", [mediaId]);
}
var handleProductUpload = uploader.array("files", 5);
var mediaRouter = Router2();
mediaRouter.post(
  "/admin/products/:productId/media",
  requireUser,
  requireAdmin,
  handleProductUpload,
  async (req, res, next) => {
    const files = req.files || [];
    const productId = String(req.params.productId);
    if (!files.length) {
      res.status(400).json({ error: "\u0627\u062E\u062A\u0631 \u0635\u0648\u0631\u0629 \u0623\u0648 \u0641\u064A\u062F\u064A\u0648 \u0644\u0631\u0641\u0639\u0647." });
      return;
    }
    const uploadedKeys = [];
    try {
      const preparedFiles = [];
      for (const file of files) {
        const detected = await fileTypeFromBuffer(file.buffer);
        if (!detected) throw new ApiError(400, "\u0646\u0648\u0639 \u0623\u062D\u062F \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645.");
        const mediaType = supportedImageTypes.has(detected.mime) ? "image" : supportedVideoTypes.has(detected.mime) ? "video" : null;
        if (!mediaType) {
          throw new ApiError(400, "\u0627\u0644\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0645\u0633\u0645\u0648\u062D\u0629: JPG \u0623\u0648 PNG \u0623\u0648 WebP \u0623\u0648 GIF\u060C \u0648\u0641\u064A\u062F\u064A\u0648 MP4 \u0623\u0648 WebM \u0623\u0648 MOV.");
        }
        if (mediaType === "image" && file.size > 8 * 1024 * 1024) {
          throw new ApiError(413, "\u062D\u062C\u0645 \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0648\u0627\u062D\u062F\u0629 \u0644\u0627 \u064A\u0632\u064A\u062F \u0639\u0646 8 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A.");
        }
        const mediaId = randomUUID2();
        const objectKey = `products/${productId}/${mediaId}.${detected.ext}`;
        const safeName = basename(file.originalname || `media.${detected.ext}`).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 240) || `media.${detected.ext}`;
        preparedFiles.push({ file, detected, mediaType, mediaId, objectKey, safeName });
      }
      for (const item of preparedFiles) {
        const uploadResult = await withStorage(
          (client) => client.uploadFromBytes(item.objectKey, item.file.buffer)
        );
        if (!uploadResult.ok) throw new ApiError(502, "\u062A\u0639\u0630\u0631 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641 \u0625\u0644\u0649 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u062A\u062E\u0632\u064A\u0646.");
        uploadedKeys.push(item.objectKey);
      }
      const savedMedia = await withTransaction(async (client) => {
        const product = await client.query(
          "SELECT id FROM store_products WHERE id = $1 FOR UPDATE",
          [productId]
        );
        if (!product.rowCount) throw new ApiError(404, "\u0627\u0644\u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
        const results = [];
        for (const item of preparedFiles) {
          const sortResult = await client.query(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_media WHERE product_id = $1",
            [productId]
          );
          const inserted = await client.query(
            `INSERT INTO product_media (
              id, product_id, storage_key, media_type, mime_type,
              original_name, size_bytes, sort_order, uploaded_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id, media_type, mime_type, original_name, sort_order`,
            [
              item.mediaId,
              productId,
              item.objectKey,
              item.mediaType,
              item.detected.mime,
              item.safeName,
              item.file.size,
              sortResult.rows[0].next,
              req.appUser.clerkUserId
            ]
          );
          const row = inserted.rows[0];
          results.push({
            id: row.id,
            mediaType: row.media_type,
            mimeType: row.mime_type,
            originalName: row.original_name,
            sortOrder: row.sort_order,
            url: `/api/media/${row.id}`
          });
        }
        return results;
      });
      res.status(201).json({ media: savedMedia });
    } catch (error) {
      await Promise.allSettled(
        uploadedKeys.map(
          (key) => withStorage((client) => client.delete(key, { ignoreNotFound: true }))
        )
      );
      next(error);
    }
  }
);
mediaRouter.delete(
  "/admin/media/:mediaId",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      await deleteMediaObject(String(req.params.mediaId));
      res.json({ message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0644\u0641." });
    } catch (error) {
      next(error);
    }
  }
);
mediaRouter.get("/media/:mediaId", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT m.storage_key, m.mime_type, m.original_name
       FROM product_media m
       JOIN store_products p ON p.id = m.product_id
       WHERE m.id = $1 AND p.is_active = TRUE`,
      [req.params.mediaId]
    );
    if (!result.rowCount) {
      res.status(404).json({ error: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
      return;
    }
    const download = await withStorage(
      (client) => client.downloadAsBytes(result.rows[0].storage_key)
    );
    if (!download.ok) {
      res.status(502).json({ error: "\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0644\u0641 \u0645\u0646 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u062A\u062E\u0632\u064A\u0646." });
      return;
    }
    const [bytes] = download.value;
    res.setHeader("Content-Type", result.rows[0].mime_type);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(result.rows[0].original_name)}"`);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(bytes);
  } catch (error) {
    next(error);
  }
});

// server/catalog.ts
function asText(value, field, maxLength, required = false) {
  const result = String(value ?? "").trim();
  if (required && !result) throw new ApiError(400, `\u062D\u0642\u0644 ${field} \u0645\u0637\u0644\u0648\u0628.`);
  if (result.length > maxLength) throw new ApiError(400, `\u062D\u0642\u0644 ${field} \u0623\u0637\u0648\u0644 \u0645\u0646 \u0627\u0644\u0645\u0633\u0645\u0648\u062D.`);
  return result;
}
function asNumber(value, field, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || options.max !== void 0 && number > options.max) {
    throw new ApiError(400, `\u0642\u064A\u0645\u0629 ${field} \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629.`);
  }
  if (options.integer && !Number.isInteger(number)) {
    throw new ApiError(400, `\u0642\u064A\u0645\u0629 ${field} \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0631\u0642\u0645\u064B\u0627 \u0635\u062D\u064A\u062D\u064B\u0627.`);
  }
  return number;
}
function mapCategory(row) {
  return {
    id: row.id,
    nameAr: row.name_ar,
    icon: row.icon,
    slug: row.id,
    sortOrder: row.sort_order
  };
}
async function getCategories() {
  const result = await query(
    "SELECT id, name_ar, icon, sort_order FROM store_categories ORDER BY sort_order, name_ar"
  );
  return result.rows.map(mapCategory);
}
async function getProducts(includeInactive = false) {
  const result = await query(
    `SELECT p.*, c.name_ar AS category_name_ar
     FROM store_products p
     JOIN store_categories c ON c.id = p.category_id
     ${includeInactive ? "" : "WHERE p.is_active = TRUE"}
     ORDER BY p.is_featured DESC, p.created_at DESC`
  );
  if (!result.rowCount) return [];
  const ids = result.rows.map((row) => row.id);
  const mediaResult = await query(
    `SELECT id, product_id, media_type, mime_type, original_name, sort_order, created_at
     FROM product_media WHERE product_id = ANY($1::text[]) ORDER BY sort_order, created_at`,
    [ids]
  );
  const mediaByProduct = /* @__PURE__ */ new Map();
  for (const row of mediaResult.rows) {
    const list = mediaByProduct.get(row.product_id) || [];
    list.push({
      id: row.id,
      mediaType: row.media_type,
      mimeType: row.mime_type,
      originalName: row.original_name,
      sortOrder: row.sort_order,
      url: `/api/media/${row.id}`
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
      createdAt: row.created_at
    };
  });
}
function parseProductInput(body) {
  const sourceVariants = body.variants === void 0 ? [] : body.variants;
  if (!Array.isArray(sourceVariants) || sourceVariants.length > 20) {
    throw new ApiError(400, "\u0623\u0636\u0641 \u062D\u062A\u0649 20 \u062E\u064A\u0627\u0631\u064B\u0627 \u0645\u062E\u062A\u0644\u0641\u064B\u0627 \u0644\u0644\u0645\u0646\u062A\u062C.");
  }
  const seenVariantIds = /* @__PURE__ */ new Set();
  const variants = sourceVariants.map((source, index) => {
    const variant = source;
    const id = asText(variant.id, `\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062E\u064A\u0627\u0631 ${index + 1}`, 80) || randomUUID3();
    if (seenVariantIds.has(id)) throw new ApiError(400, "\u0645\u0639\u0631\u0651\u0641\u0627\u062A \u062E\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0646\u062A\u062C \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0645\u062E\u062A\u0644\u0641\u0629.");
    seenVariantIds.add(id);
    return {
      id,
      nameAr: asText(variant.nameAr, "\u0627\u0633\u0645 \u0627\u0644\u062E\u064A\u0627\u0631", 100, true),
      packageSize: asText(variant.packageSize, "\u062D\u062C\u0645 \u0627\u0644\u062E\u064A\u0627\u0631", 100, true),
      price: asNumber(variant.price, "\u0633\u0639\u0631 \u0627\u0644\u062E\u064A\u0627\u0631"),
      originalPrice: variant.originalPrice === "" || variant.originalPrice === null || variant.originalPrice === void 0 ? null : asNumber(variant.originalPrice, "\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0633\u0627\u0628\u0642 \u0644\u0644\u062E\u064A\u0627\u0631"),
      stockQuantity: asNumber(variant.stockQuantity, "\u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u062E\u064A\u0627\u0631", { integer: true, max: 1e5 }),
      isAvailable: variant.isAvailable !== false
    };
  });
  const totalVariantStock = variants.reduce((sum, variant) => sum + variant.stockQuantity, 0);
  if (totalVariantStock > 1e5) throw new ApiError(400, "\u0625\u062C\u0645\u0627\u0644\u064A \u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0645\u0633\u0645\u0648\u062D.");
  return {
    nameAr: asText(body.nameAr, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C", 160, true),
    brand: asText(body.brand, "\u0627\u0644\u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629", 120),
    categoryId: asText(body.categoryId, "\u0627\u0644\u0642\u0633\u0645", 80, true),
    subcategoryAr: asText(body.subcategoryAr, "\u0646\u0648\u0639 \u0627\u0644\u0645\u0646\u062A\u062C", 100),
    shortDescription: asText(body.shortDescription, "\u0627\u0644\u0648\u0635\u0641 \u0627\u0644\u0645\u062E\u062A\u0635\u0631", 300),
    fullDescription: asText(body.fullDescription, "\u0627\u0644\u0648\u0635\u0641", 3e3),
    unit: asText(body.unit, "\u0648\u062D\u062F\u0629 \u0627\u0644\u0628\u064A\u0639", 40, true),
    packageSize: asText(body.packageSize, "\u062D\u062C\u0645 \u0627\u0644\u0639\u0628\u0648\u0629", 100, true),
    price: asNumber(body.price, "\u0627\u0644\u0633\u0639\u0631"),
    originalPrice: body.originalPrice === "" || body.originalPrice === null || body.originalPrice === void 0 ? null : asNumber(body.originalPrice, "\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0633\u0627\u0628\u0642"),
    discountPercentage: asNumber(body.discountPercentage ?? 0, "\u0646\u0633\u0628\u0629 \u0627\u0644\u062E\u0635\u0645", { max: 100 }),
    offerDescription: asText(body.offerDescription, "\u0648\u0635\u0641 \u0627\u0644\u0639\u0631\u0636", 150),
    stockQuantity: variants.length ? totalVariantStock : asNumber(body.stockQuantity, "\u0627\u0644\u0643\u0645\u064A\u0629", { integer: true, max: 1e5 }),
    variants,
    isAvailable: body.isAvailable !== false,
    isFeatured: body.isFeatured === true,
    isBestSeller: body.isBestSeller === true,
    isVariableWeight: body.isVariableWeight === true,
    isDemo: body.isDemo === true,
    isActive: body.isActive !== false
  };
}
async function validateCategory(categoryId) {
  const result = await query("SELECT id FROM store_categories WHERE id = $1", [categoryId]);
  if (!result.rowCount) throw new ApiError(400, "\u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
}
async function fetchAdminProduct(id) {
  const products = await getProducts(true);
  return products.find((product) => product.id === id);
}
var catalogRouter = Router3();
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
    const nameAr = asText(req.body?.nameAr, "\u0627\u0633\u0645 \u0627\u0644\u0642\u0633\u0645", 100, true);
    const icon = asText(req.body?.icon || "Store", "\u0627\u0644\u0623\u064A\u0642\u0648\u0646\u0629", 40) || "Store";
    const id = randomUUID3();
    const orderResult = await query("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM store_categories");
    const inserted = await query(
      `INSERT INTO store_categories (id, name_ar, icon, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING id, name_ar, icon, sort_order`,
      [id, nameAr, icon, orderResult.rows[0].next]
    );
    res.status(201).json({ category: mapCategory(inserted.rows[0]) });
  } catch (error) {
    next(error);
  }
});
catalogRouter.patch("/admin/categories/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const nameAr = asText(req.body?.nameAr, "\u0627\u0633\u0645 \u0627\u0644\u0642\u0633\u0645", 100, true);
    const icon = asText(req.body?.icon || "Store", "\u0627\u0644\u0623\u064A\u0642\u0648\u0646\u0629", 40) || "Store";
    const updated = await query(
      `UPDATE store_categories SET name_ar = $1, icon = $2, updated_at = NOW()
       WHERE id = $3 RETURNING id, name_ar, icon, sort_order`,
      [nameAr, icon, req.params.id]
    );
    if (!updated.rowCount) throw new ApiError(404, "\u0627\u0644\u0642\u0633\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    res.json({ category: mapCategory(updated.rows[0]) });
  } catch (error) {
    next(error);
  }
});
catalogRouter.delete("/admin/categories/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    const used = await query("SELECT COUNT(*)::int AS count FROM store_products WHERE category_id = $1", [req.params.id]);
    if (Number(used.rows[0].count) > 0) {
      throw new ApiError(409, "\u0627\u0646\u0642\u0644 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0623\u0648 \u0627\u062D\u0630\u0641\u0647\u0627 \u0642\u0628\u0644 \u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645.");
    }
    const deleted = await query("DELETE FROM store_categories WHERE id = $1 RETURNING id", [req.params.id]);
    if (!deleted.rowCount) throw new ApiError(404, "\u0627\u0644\u0642\u0633\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    res.json({ message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0642\u0633\u0645." });
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
    const id = randomUUID3();
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
        id,
        slug,
        product.nameAr,
        product.brand,
        product.categoryId,
        product.subcategoryAr,
        product.shortDescription,
        product.fullDescription,
        product.unit,
        product.packageSize,
        product.price,
        product.originalPrice,
        product.discountPercentage,
        product.offerDescription,
        product.stockQuantity,
        product.isAvailable,
        product.isFeatured,
        product.isBestSeller,
        product.isVariableWeight,
        product.isDemo,
        product.isActive,
        JSON.stringify(product.variants)
      ]
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
        product.nameAr,
        product.brand,
        product.categoryId,
        product.subcategoryAr,
        product.shortDescription,
        product.fullDescription,
        product.unit,
        product.packageSize,
        product.price,
        product.originalPrice,
        product.discountPercentage,
        product.offerDescription,
        product.stockQuantity,
        product.isAvailable,
        product.isFeatured,
        product.isBestSeller,
        product.isVariableWeight,
        product.isDemo,
        product.isActive,
        JSON.stringify(product.variants),
        req.params.id
      ]
    );
    if (!updated.rowCount) throw new ApiError(404, "\u0627\u0644\u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    res.json({ product: await fetchAdminProduct(String(req.params.id)) });
  } catch (error) {
    next(error);
  }
});
catalogRouter.delete("/admin/products/:id", requireUser, requireAdmin, async (req, res, next) => {
  try {
    await deleteProductMediaObjects(String(req.params.id));
    const deleted = await query("DELETE FROM store_products WHERE id = $1 RETURNING id", [req.params.id]);
    if (!deleted.rowCount) throw new ApiError(404, "\u0627\u0644\u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
    res.json({ message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0646\u062A\u062C." });
  } catch (error) {
    next(error);
  }
});

// server/middlewares/clerkProxyMiddleware.ts
import { createProxyMiddleware } from "http-proxy-middleware";
var CLERK_FAPI = "https://frontend-api.clerk.dev";
var CLERK_PROXY_PATH = "/api/__clerk";
function getClerkProxyHost(req) {
  const forwarded = req.headers["x-forwarded-host"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstHop = raw?.split(",")[0]?.trim();
  return firstHop || req.headers.host?.trim() || void 0;
}
function clerkProxyMiddleware() {
  if (process.env.NODE_ENV !== "production") {
    return (_req, _res, next) => next();
  }
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }
  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    // Take over the response so it can be re-sent with a Content-Length (see
    // proxyRes); the deployment edge rejects chunked proxied responses.
    selfHandleResponse: true,
    pathRewrite: (path2) => path2.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq, req) => {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = getClerkProxyHost(req) || "";
        const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;
        proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);
        const xff = req.headers["x-forwarded-for"];
        const clientIp = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
        if (clientIp) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }
      },
      // Clerk's dynamic Frontend API responses (/v1/environment, /v1/client,
      // JWKS, ...) arrive without a Content-Length, so relaying them would use
      // Transfer-Encoding: chunked — which the deployment edge (Cloud Run)
      // rejects, turning the app's 200 into a 500. Buffer only those so they can
      // be re-sent with a Content-Length; the body is forwarded untouched so
      // Content-Encoding is preserved. Length-known responses (e.g. /npm/*
      // assets) and body-less responses stream through without buffering.
      proxyRes: (proxyRes, req, res) => {
        const headers = { ...proxyRes.headers };
        delete headers["transfer-encoding"];
        delete headers["connection"];
        delete headers["keep-alive"];
        const status = proxyRes.statusCode ?? 502;
        if (status < 200 || status === 204) {
          delete headers["content-length"];
        }
        const bodyless = req.method === "HEAD" || status < 200 || status === 204 || status === 304;
        if (headers["content-length"] !== void 0 || bodyless) {
          res.writeHead(status, headers);
          proxyRes.on("error", () => res.destroy());
          proxyRes.pipe(res);
          return;
        }
        const chunks = [];
        proxyRes.on("data", (chunk) => chunks.push(chunk));
        proxyRes.on("end", () => {
          const body = Buffer.concat(chunks);
          headers["content-length"] = String(body.length);
          res.writeHead(status, headers);
          res.end(body);
        });
        proxyRes.on("error", () => {
          if (!res.headersSent) {
            res.writeHead(502, { "content-length": "0" });
          }
          res.end();
        });
      }
    }
  });
}

// server/orders.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import { Router as Router4 } from "express";
var validStatuses = /* @__PURE__ */ new Set([
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled"
]);
function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}
function validateOrderContact(body, fallback) {
  const fullName = String(body.fullName || fallback?.fullName || "").trim();
  const phone = cleanPhone(body.phone || fallback?.phone);
  const whatsappPhone = cleanPhone(body.whatsappPhone || fallback?.whatsappPhone);
  const governorate = String(body.governorate || fallback?.governorate || "").trim();
  const city = String(body.city || fallback?.city || "").trim();
  const address = String(body.address || fallback?.address || "").trim();
  const landmark = String(body.landmark || fallback?.landmark || "").trim();
  const notes = String(body.notes || "").trim();
  if (fullName.length < 2 || fullName.length > 120) throw new ApiError(400, "\u0627\u0643\u062A\u0628 \u0627\u0644\u0627\u0633\u0645 \u0628\u0637\u0648\u0644 \u0635\u062D\u064A\u062D.");
  if (!/^01[0125]\d{8}$/.test(phone)) throw new ApiError(400, "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0627\u0644\u0645\u0635\u0631\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D.");
  if (whatsappPhone && !/^01[0125]\d{8}$/.test(whatsappPhone)) {
    throw new ApiError(400, "\u0631\u0642\u0645 \u0648\u0627\u062A\u0633\u0627\u0628 \u0627\u0644\u0645\u0635\u0631\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D.");
  }
  if (!governorate || governorate.length > 100) throw new ApiError(400, "\u0627\u062E\u062A\u0631 \u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0629.");
  if (city.length < 2 || city.length > 120) throw new ApiError(400, "\u0627\u0643\u062A\u0628 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0623\u0648 \u0627\u0644\u0645\u062F\u064A\u0646\u0629.");
  if (address.length < 5 || address.length > 240) throw new ApiError(400, "\u0627\u0643\u062A\u0628 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0628\u0627\u0644\u062A\u0641\u0635\u064A\u0644.");
  if (landmark.length > 160 || notes.length > 500) throw new ApiError(400, "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0623\u0648 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0623\u0637\u0648\u0644 \u0645\u0646 \u0627\u0644\u0645\u0633\u0645\u0648\u062D.");
  return { fullName, phone, whatsappPhone, governorate, city, address, landmark, notes };
}
async function getOrders(where = "", values = []) {
  const orders = await query(
    `SELECT o.*, u.email AS customer_email
     FROM store_orders o
     JOIN store_users u ON u.clerk_user_id = o.user_id
     ${where}
     ORDER BY o.created_at DESC LIMIT 200`,
    values
  );
  if (!orders.rowCount) return [];
  const ids = orders.rows.map((order) => order.id);
  const items = await query(
    `SELECT id, order_id, product_id, product_name, variant_id, variant_name, package_size,
            unit_price, quantity, line_total
     FROM store_order_items
     WHERE order_id = ANY($1::uuid[])
     ORDER BY product_name`,
    [ids]
  );
  const itemsByOrder = /* @__PURE__ */ new Map();
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
      lineTotal: Number(item.line_total)
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
    items: itemsByOrder.get(order.id) || []
  }));
}
async function restoreOrderInventory(client, orderId) {
  await client.query(
    `UPDATE store_products p SET stock_quantity = p.stock_quantity + i.quantity,
      updated_at = NOW()
     FROM store_order_items i
     WHERE i.order_id = $1 AND p.id = i.product_id`,
    [orderId]
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
    [orderId]
  );
}
var ordersRouter = Router4();
ordersRouter.post("/orders", requireUser, async (req, res, next) => {
  const sourceItems = req.body?.items;
  if (!Array.isArray(sourceItems) || sourceItems.length < 1 || sourceItems.length > 30) {
    res.status(400).json({ error: "\u0627\u0644\u0633\u0644\u0629 \u0641\u0627\u0631\u063A\u0629 \u0623\u0648 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0639\u062F\u062F \u0623\u0635\u0646\u0627\u0641 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D." });
    return;
  }
  const quantities = /* @__PURE__ */ new Map();
  for (const item of sourceItems) {
    const productId = String(item?.productId || "").trim();
    const variantId = String(item?.variantId || "").trim();
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0623\u062D\u062F \u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." });
      return;
    }
    const key = `${productId}\0${variantId}`;
    const current = quantities.get(key);
    quantities.set(key, { productId, variantId, quantity: (current?.quantity || 0) + quantity });
  }
  const contact = validateOrderContact(req.body || {}, req.appUser);
  try {
    const order = await withTransaction(async (client) => {
      const orderId = randomUUID4();
      const orderNumber = `ABU-${randomUUID4().slice(0, 8).toUpperCase()}`;
      const resolvedItems = [];
      let subtotal = 0;
      for (const { productId, variantId, quantity } of quantities.values()) {
        const found = await client.query(
          `SELECT id, name_ar, package_size, price, stock_quantity, variants,
                  is_available, is_demo, is_active
           FROM store_products WHERE id = $1 FOR UPDATE`,
          [productId]
        );
        if (!found.rowCount) throw new ApiError(409, "\u0623\u062D\u062F \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0644\u0645 \u064A\u0639\u062F \u0645\u0648\u062C\u0648\u062F\u064B\u0627 \u0641\u064A \u0627\u0644\u0645\u062A\u062C\u0631.");
        const product = found.rows[0];
        const productVariants = Array.isArray(product.variants) ? product.variants : [];
        let selectedVariant = null;
        if (variantId) {
          selectedVariant = productVariants.find(
            (variant) => variant.id === variantId && variant.isAvailable !== false
          ) || null;
          if (!selectedVariant) throw new ApiError(409, `\u0627\u0644\u062E\u064A\u0627\u0631 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0645\u0646 ${product.name_ar} \u0644\u0645 \u064A\u0639\u062F \u0645\u062A\u0627\u062D\u064B\u0627.`);
        } else if (productVariants.length) {
          throw new ApiError(409, `\u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u0627\u0644\u0639\u0628\u0648\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0645\u0646 ${product.name_ar}.`);
        }
        if (product.is_demo) {
          throw new ApiError(409, "\u0628\u0639\u0636 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0645\u0627 \u0632\u0627\u0644\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629\u061B \u0644\u0646 \u064A\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0637\u0644\u0628 \u0628\u0633\u0639\u0631 \u0623\u0648 \u0645\u062E\u0632\u0648\u0646 \u063A\u064A\u0631 \u0645\u0624\u0643\u062F.", "DEMO_PRODUCT");
        }
        if (!product.is_active || !product.is_available) {
          throw new ApiError(409, `\u0627\u0644\u0645\u0646\u062A\u062C ${product.name_ar} \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u062D\u0627\u0644\u064A\u064B\u0627.`);
        }
        const availableQuantity = selectedVariant ? Number(selectedVariant.stockQuantity) : Number(product.stock_quantity);
        if (availableQuantity < quantity) {
          throw new ApiError(409, `\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0645\u0646 ${product.name_ar} \u0623\u0642\u0644 \u0645\u0646 \u0627\u0644\u0645\u0637\u0644\u0648\u0628.`);
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
          lineTotal
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
            [item.quantity, item.variantId, item.id]
          );
        } else {
          await client.query(
            "UPDATE store_products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2",
            [item.quantity, item.id]
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
          req.appUser.clerkUserId,
          contact.fullName,
          contact.phone,
          contact.whatsappPhone,
          contact.governorate,
          contact.city,
          contact.address,
          contact.landmark,
          contact.notes,
          subtotal
        ]
      );
      for (const item of resolvedItems) {
        await client.query(
          `INSERT INTO store_order_items (
            id, order_id, product_id, product_name, variant_id, variant_name, package_size,
            unit_price, quantity, line_total
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            randomUUID4(),
            orderId,
            item.id,
            item.name_ar,
            item.variantId,
            item.variantName,
            item.package_size,
            item.unitPrice,
            item.quantity,
            item.lineTotal
          ]
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
          req.appUser.clerkUserId
        ]
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
    const orders = await getOrders("WHERE o.user_id = $1", [req.appUser.clerkUserId]);
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
        [req.params.orderId, req.appUser.clerkUserId]
      );
      if (!found.rowCount) throw new ApiError(404, "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
      if (found.rows[0].status !== "pending") {
        throw new ApiError(409, "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0637\u0644\u0628 \u0628\u0639\u062F \u0623\u0646 \u064A\u0628\u062F\u0623 \u0627\u0644\u0645\u062A\u062C\u0631 \u062A\u062C\u0647\u064A\u0632\u0647.");
      }
      await restoreOrderInventory(client, String(req.params.orderId));
      await client.query(
        "UPDATE store_orders SET status='cancelled', updated_at=NOW() WHERE id=$1",
        [req.params.orderId]
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
    res.status(400).json({ error: "\u0641\u0644\u062A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
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
      res.status(400).json({ error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." });
      return;
    }
    try {
      const updated = await withTransaction(async (client) => {
        const found = await client.query(
          "SELECT id, status FROM store_orders WHERE id = $1 FOR UPDATE",
          [req.params.orderId]
        );
        if (!found.rowCount) throw new ApiError(404, "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.");
        const previousStatus = String(found.rows[0].status);
        if (previousStatus === "cancelled" && status !== "cancelled") {
          throw new ApiError(409, "\u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u0644\u063A\u064A \u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0639\u0627\u062F\u062A\u0647 \u0625\u0644\u0649 \u062F\u0648\u0631\u0629 \u0627\u0644\u062A\u062C\u0647\u064A\u0632.");
        }
        if (previousStatus === "delivered" && status !== "delivered") {
          throw new ApiError(409, "\u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0630\u064A \u062A\u0645 \u062A\u0633\u0644\u064A\u0645\u0647 \u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u062A\u0647.");
        }
        if (status === "cancelled" && previousStatus !== "cancelled") {
          await restoreOrderInventory(client, String(req.params.orderId));
        }
        await client.query(
          "UPDATE store_orders SET status=$1, updated_at=NOW() WHERE id=$2",
          [status, req.params.orderId]
        );
        return { id: req.params.orderId, status };
      });
      res.json({ order: updated });
    } catch (error) {
      next(error);
    }
  }
);

// server/index.ts
var app = express();
var currentFile = fileURLToPath(import.meta.url);
var currentDir = path.dirname(currentFile);
var projectRoot = path.resolve(currentDir, "..");
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY
    )
  }))
);
var sameOriginWrites = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  const origin = req.get("origin");
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || req.get("host");
  if (!origin || !requestHost) {
    res.status(403).json({ error: "\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u0635\u062F\u0631 \u0627\u0644\u0637\u0644\u0628." });
    return;
  }
  try {
    if (new URL(origin).host.toLowerCase() !== requestHost.toLowerCase()) {
      res.status(403).json({ error: "\u062A\u0645 \u0631\u0641\u0636 \u0627\u0644\u0637\u0644\u0628 \u0644\u0639\u062F\u0645 \u062A\u0637\u0627\u0628\u0642 \u0645\u0635\u062F\u0631\u0647 \u0645\u0639 \u0627\u0644\u0645\u062A\u062C\u0631." });
      return;
    }
  } catch {
    res.status(403).json({ error: "\u0645\u0635\u062F\u0631 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
    return;
  }
  next();
};
app.use("/api", sameOriginWrites);
app.use("/api", authRouter);
app.use("/api", catalogRouter);
app.use("/api", mediaRouter);
app.use("/api", ordersRouter);
if (process.env.NODE_ENV === "production") {
  const distDir = path.join(projectRoot, "dist");
  app.use(express.static(distDir, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    configFile: path.join(projectRoot, "vite.config.ts"),
    root: projectRoot,
    server: { middlewareMode: true, hmr: { server: void 0 } },
    appType: "spa"
  });
  app.use(vite.middlewares);
}
app.use((req, res) => {
  res.status(404).json({ error: "\u0627\u0644\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
});
app.use((error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  if (typeof error === "object" && error !== null && "code" in error && String(error.code).startsWith("LIMIT_")) {
    res.status(413).json({ error: "\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 \u0623\u0648 \u0639\u062F\u062F \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0645\u0633\u0645\u0648\u062D." });
    return;
  }
  console.error("Unhandled supermarket API error:", error);
  res.status(500).json({ error: "\u062D\u0635\u0644 \u062E\u0637\u0623 \u062F\u0627\u062E\u0644\u064A. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." });
});
var port = Number(process.env.PORT || 5e3);
var server = app.listen(port, "0.0.0.0", () => {
  console.log(`Supermarket server listening on port ${port}`);
});
var shutdown = () => {
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
