import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { authRouter } from "./auth";
import { catalogRouter } from "./catalog";
import { ApiError } from "./errors";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { mediaRouter } from "./media";
import { ordersRouter } from "./orders";
import { pool } from "./db";

const app = express();
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const projectRoot = path.resolve(currentDir, "..");

app.disable("x-powered-by");
app.set("trust proxy", 1);

// Clerk's proxy streams the original body, so it must run before parsers.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

const sameOriginWrites = (req: Request, res: Response, next: NextFunction) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || req.get("host");
  if (!origin || !requestHost) {
    res.status(403).json({ error: "تعذر التحقق من مصدر الطلب." });
    return;
  }

  try {
    if (new URL(origin).host.toLowerCase() !== requestHost.toLowerCase()) {
      res.status(403).json({ error: "تم رفض الطلب لعدم تطابق مصدره مع المتجر." });
      return;
    }
  } catch {
    res.status(403).json({ error: "مصدر الطلب غير صحيح." });
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
    server: { middlewareMode: true, hmr: { server: undefined } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.use((req, res) => {
  res.status(404).json({ error: "المسار غير موجود." });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String(error.code).startsWith("LIMIT_")
  ) {
    res.status(413).json({ error: "حجم الملف أو عدد الملفات أكبر من المسموح." });
    return;
  }
  console.error("Unhandled supermarket API error:", error);
  res.status(500).json({ error: "حصل خطأ داخلي. حاول مرة أخرى." });
});

const port = Number(process.env.PORT || 5000);
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Supermarket server listening on port ${port}`);
});

const shutdown = () => {
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
