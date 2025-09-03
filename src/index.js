import { Router } from "express";
import publicRoutes from "./routes/public.routes.js";
// import webhookRoutes from "./routes/webhook-copy.routes.js";

const router = Router();

router.use("/api", publicRoutes); // /api/public/*
// router.use("/webhooks", webhookRoutes); // /webhooks/*

export default router;
