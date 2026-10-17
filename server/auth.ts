import { randomUUID } from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { query } from "./db";
import { ApiError } from "./errors";

export interface AppUser {
  clerkUserId: string;
  email: string;
  fullName: string;
  phone: string;
  whatsappPhone: string;
  governorate: string;
  city: string;
  address: string;
  landmark: string;
  role: "customer" | "admin";
  createdAt: string;
}

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUser;
    }
  }
}

const mapUser = (row: Record<string, unknown>): AppUser => ({
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
  createdAt: new Date(String(row.created_at)).toISOString(),
});

async function getOrCreateAppUser(clerkUserId: string): Promise<AppUser> {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId,
  );
  if (!primaryEmail?.emailAddress || primaryEmail.verification?.status !== "verified") {
    throw new ApiError(403, "يجب تأكيد البريد الإلكتروني قبل استخدام المتجر.", "EMAIL_NOT_VERIFIED");
  }

  const email = primaryEmail.emailAddress.trim().toLowerCase();
  const pendingInvite = await query(
    "SELECT id FROM admin_invites WHERE email = $1 AND accepted_at IS NULL",
    [email],
  );
  const isBootstrapAdmin =
    email === (process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
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
    [clerkUserId, email, clerkName, role],
  );

  if (pendingInvite.rowCount) {
    await query(
      `UPDATE admin_invites
       SET accepted_by = $1, accepted_at = NOW()
       WHERE email = $2 AND accepted_at IS NULL`,
      [clerkUserId, email],
    );
  }

  return mapUser(inserted.rows[0]);
}

export const requireUser: RequestHandler = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "سجّل الدخول للمتابعة.", code: "AUTH_REQUIRED" });
    return;
  }
  try {
    req.appUser = await getOrCreateAppUser(userId);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.appUser) {
    res.status(401).json({ error: "سجّل الدخول للمتابعة.", code: "AUTH_REQUIRED" });
    return;
  }
  if (req.appUser.role !== "admin") {
    res.status(403).json({ error: "الصلاحية دي متاحة لمدير المتجر فقط.", code: "ADMIN_REQUIRED" });
    return;
  }
  next();
};

export const authRouter = Router();

authRouter.get("/me", requireUser, (req: Request, res) => {
  res.json({ user: req.appUser });
});

authRouter.patch("/me", requireUser, async (req: Request, res, next) => {
  const body = req.body || {};
  const fullName = String(body.fullName || "").trim();
  const phone = String(body.phone || "").replace(/\D/g, "");
  const whatsappPhone = String(body.whatsappPhone || "").replace(/\D/g, "");
  const governorate = String(body.governorate || "").trim();
  const city = String(body.city || "").trim();
  const address = String(body.address || "").trim();
  const landmark = String(body.landmark || "").trim();

  if (fullName.length < 2 || fullName.length > 120) {
    res.status(400).json({ error: "اكتب الاسم بطول صحيح." });
    return;
  }
  if (phone && !/^01[0125]\d{8}$/.test(phone)) {
    res.status(400).json({ error: "رقم الهاتف المصري غير صحيح." });
    return;
  }
  if (whatsappPhone && !/^01[0125]\d{8}$/.test(whatsappPhone)) {
    res.status(400).json({ error: "رقم واتساب المصري غير صحيح." });
    return;
  }
  if ([governorate, city, address, landmark].some((value) => value.length > 240)) {
    res.status(400).json({ error: "بعض بيانات العنوان أطول من المسموح." });
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
        req.appUser!.clerkUserId,
      ],
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
         FROM store_users WHERE role = 'admin' ORDER BY created_at`,
      ),
      query(
        `SELECT id, email, created_at
         FROM admin_invites WHERE accepted_at IS NULL ORDER BY created_at DESC`,
      ),
    ]);
    res.json({
      admins: admins.rows.map((row) => ({
        clerkUserId: row.clerk_user_id,
        email: row.email,
        fullName: row.full_name,
        createdAt: row.created_at,
      })),
      invites: invites.rows.map((row) => ({
        id: row.id,
        email: row.email,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/admin/admins", requireUser, requireAdmin, async (req, res, next) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    res.status(400).json({ error: "اكتب بريدًا إلكترونيًا صحيحًا." });
    return;
  }
  if (email === req.appUser!.email) {
    res.status(400).json({ error: "حسابك بالفعل مدير." });
    return;
  }

  try {
    const existingUser = await query(
      "SELECT clerk_user_id FROM store_users WHERE email = $1",
      [email],
    );
    if (existingUser.rowCount) {
      await query(
        "UPDATE store_users SET role = 'admin', updated_at = NOW() WHERE clerk_user_id = $1",
        [existingUser.rows[0].clerk_user_id],
      );
      res.json({ message: "تمت إضافة المستخدم كمدير.", activated: true });
      return;
    }

    await query(
      `INSERT INTO admin_invites (id, email, invited_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET invited_by = EXCLUDED.invited_by, accepted_by = NULL, accepted_at = NULL`,
      [randomUUID(), email, req.appUser!.clerkUserId],
    );
    res.status(201).json({
      message: "تم تسجيل الدعوة. يكتسب الحساب صلاحية المدير بعد التسجيل بهذا البريد وتأكيده.",
      activated: false,
      signUpPath: "/sign-up",
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
    if (targetId === req.appUser!.clerkUserId) {
      res.status(400).json({ error: "لا يمكن إزالة صلاحية حسابك من هنا." });
      return;
    }
    try {
      const result = await query(
        "SELECT COUNT(*)::int AS count FROM store_users WHERE role = 'admin'",
      );
      if (Number(result.rows[0].count) <= 1) {
        res.status(409).json({ error: "لا يمكن إزالة آخر مدير في المتجر." });
        return;
      }
      const updated = await query(
        `UPDATE store_users SET role = 'customer', updated_at = NOW()
         WHERE clerk_user_id = $1 AND role = 'admin' RETURNING clerk_user_id`,
        [targetId],
      );
      if (!updated.rowCount) {
        res.status(404).json({ error: "المدير غير موجود." });
        return;
      }
      res.json({ message: "تم إلغاء صلاحية المدير." });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.delete(
  "/admin/admin-invites/:inviteId",
  requireUser,
  requireAdmin,
  async (req, res, next) => {
    try {
      const deleted = await query(
        "DELETE FROM admin_invites WHERE id = $1 AND accepted_at IS NULL RETURNING id",
        [req.params.inviteId],
      );
      if (!deleted.rowCount) {
        res.status(404).json({ error: "الدعوة غير موجودة أو تم قبولها." });
        return;
      }
      res.json({ message: "تم إلغاء الدعوة." });
    } catch (error) {
      next(error);
    }
  },
);
