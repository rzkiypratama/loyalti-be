import crypto from "crypto";

const DEDUPE_MS = 10 * 60 * 1000;
const seen = new Map();

function verifyHmac(req, secret) {
  const hmac = req.get("X-Shopify-Hmac-Sha256") || "";
  const digest = crypto
    .createHmac("sha256", secret)
    .update(req.body, "utf8")
    .digest("base64");
  if (hmac.length !== digest.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(digest));
  } catch {
    return false;
  }
}

export function webhookGuard(req, res, next) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return res.sendStatus(500);

  if (!verifyHmac(req, secret)) return res.sendStatus(401);

  // dedupe
  const id = req.get("X-Shopify-Webhook-Id");
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > DEDUPE_MS) seen.delete(k);
  if (id && seen.has(id)) return res.sendStatus(200);
  if (id) seen.set(id, now);

  // parse JSON
  try {
    req.shopify = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.sendStatus(400);
  }

  req.shopDomain = req.get("X-Shopify-Shop-Domain");
  req.topic = req.get("X-Shopify-Topic");
  next();
}
