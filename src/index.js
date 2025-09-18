import { Router } from "express";
import publicRoutes from "./routes/public.routes.js";
import vouchersRoutes from "./routes/vouchers.routes.js";
// import webhookRoutes from "./routes/webhook-copy.routes.js";

const router = Router();

router.use("/api", publicRoutes); // /api/public/*
router.use("/api", vouchersRoutes);
// router.use("/webhooks", webhookRoutes); // /webhooks/*

export default router;
