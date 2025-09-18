import { Router } from "express";
import {
  getVouchers,
  postRedeemVoucher,
} from "../controllers/vouchers.controller.js";
import { authMiddleware } from "../middlewares/auth.js";

const r = Router();
r.get("/vouchers", authMiddleware, getVouchers); // list vouchers
r.post("/vouchers/redeem", authMiddleware, postRedeemVoucher); // redeem voucher
export default r;
