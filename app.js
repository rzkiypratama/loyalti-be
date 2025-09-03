// app.js
import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import morgan from "morgan";
import cors from "cors";
import { fileURLToPath } from "node:url";
import "./src/configs/env.js"; // load .env
import routes from "./src/index.js";
import { logger } from "./src/utils/logger.js";
import { webhookHandler } from "./src/controllers/webhook.controller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

/* ---------- static & health ---------- */
app.use("/public", express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.type("text").send("ok"));

/* ---------- logging & CORS ---------- */
app.use(morgan("tiny"));
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true }));

/* ---------- WEBHOOKS: raw body + HMAC guard ---------- */
// NOTE: raw hanya untuk /webhooks. Jangan pakai express.json() di sini.
app.use(
  "/webhooks",
  express.raw({ type: "application/json" }),
  webhookGuard,
  webhookHandler // <-- daftar path spesifik ada di sini
);
// route webhook (satu pintu)
// app.post("/webhooks/:rest(.*)", webhookHandler);

/* ---------- APIs biasa ---------- */
app.use(express.json());
app.use(routes);

/* ---------- error handler ---------- */
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error(err);
  res.status(err.status || 500).json({ error: "internal_error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => logger.info(`API listening on :${PORT}`));

/* ---------- HMAC guard ---------- */
function webhookGuard(req, res, next) {
  try {
    const secret = (process.env.SHOPIFY_WEBHOOK_SECRET || "").trim();
    const hmacHeader = req.get("x-shopify-hmac-sha256") || "";
    const topic = req.get("x-shopify-topic") || "";
    const shopDomain = req.get("x-shopify-shop-domain") || "";

    // verifikasi HMAC dari RAW buffer
    const digest = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("base64");
    if (digest !== hmacHeader) {
      logger.warn(`[WH] bad hmac topic=${topic} shop=${shopDomain}`);
      return res.sendStatus(401);
    }

    // parse body setelah lolos HMAC
    let parsed = {};
    try {
      parsed = JSON.parse(req.body.toString("utf8"));
    } catch {}
    req.topic = topic;
    req.shopify = { body: parsed, shop_domain: shopDomain, hmac: hmacHeader };
    next();
  } catch (e) {
    logger.error("webhookGuard error", e);
    res.sendStatus(400);
  }
}
