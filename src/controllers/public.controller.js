import jwt from "jsonwebtoken";
import {
  getOrCreateCustomerByEmail,
  getWalletView,
  redeemPoints,
} from "../models/customers.model.js";

export async function init(req, res) {
  const earnPer = 100000; // Rp100k
  const earnPts = 100;
  res.json({ earnRate: { per: earnPer, points: earnPts }, tiersEnabled: true });
}

export async function session(req, res) {
  const { shop, email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email_required" });
  const customer = await getOrCreateCustomerByEmail(email);
  const token = jwt.sign({ cid: customer.id, email }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
  res.json({ token });
}

export async function me(req, res) {
  const view = await getWalletView(req.user.cid);
  res.json(view);
}

export async function redeem(req, res) {
  const { points } = req.body || {};
  if (!Number.isInteger(points) || points <= 0)
    return res.status(400).json({ error: "bad_points" });
  const { discount_code, value_cents } = await redeemPoints(
    req.user.cid,
    points
  );
  res.json({ discount_code, value_cents });
}
