import {
  earnPointsForOrder,
  rollbackForRefund,
  grantSignupBonus,
} from "../models/points.model.js";
import { query } from "../configs/db.js";

export async function webhookHandler(req, res) {
  res.sendStatus(200); // reply cepat

  const topic = req.topic; // di-set di webhookGuard
  const shopify = req.shopify || {};
  const body = shopify.body || req.body || {};

  try {
    if (topic === "orders/create") {
      await earnPointsForOrder(body); // <<— FIX: kirim order body
    } else if (topic === "orders/updated") {
      // TODO
    } else if (topic === "refunds/create") {
      await rollbackForRefund(body); // <<— FIX
    } else if (topic === "customers/create") {
      console.log(
        "[WH] customers/create shop=%s email=%s id=%s",
        shopify.shop_domain,
        body?.email,
        body?.id
      );

      const email = (body.email || "").toLowerCase().trim();
      if (!email) return;

      const name = `${body.first_name || ""} ${body.last_name || ""}`.trim();
      const rows = await query(
        `INSERT INTO customers(email, name)
           VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [email, name]
      );
      const customerId = rows[0].id;

      await query(
        `INSERT INTO point_wallets(customer_id, balance, lifetime_points)
           VALUES ($1, 0, 0)
         ON CONFLICT (customer_id) DO NOTHING`,
        [customerId]
      );

      const bonus = parseInt(process.env.SIGNUP_BONUS_POINTS || "200", 10);
      if (Number.isFinite(bonus) && bonus > 0) {
        await grantSignupBonus(customerId, bonus);
      }
    }
  } catch (e) {
    console.error("Webhook worker error", topic, e);
  }
}
