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
  try {
    const { points } = req.body || {};
    const result = await redeemPoints(req.user.cid, points);
    // kalau nanti mau return discount code, tambahkan di sini
    res.json({ ok: true, balance: result.balance });
  } catch (e) {
    const status = e.status || 500;
    // kirimkan reason yang berguna ke frontend
    const payload = { error: e.message || "internal_error" };
    if (e.balance !== undefined) payload.balance = e.balance;
    res.status(status).json(payload);
  }
}
