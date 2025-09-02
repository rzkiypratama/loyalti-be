import express from "express";
import path from "node:path";
import bodyParser from "body-parser";
import morgan from "morgan";
import cors from "cors";
import { fileURLToPath } from "node:url";
import "./src/configs/env.js"; // load .env
import routes from "./src/index.js";
import { logger } from "./src/utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// --- static & health (Nginx juga punya /health, ini untuk app check)
app.use("/public", express.static(path.join(__dirname, "public")));
app.get("/health-app", (req, res) => res.type("text").send("ok"));

// --- logging & CORS
app.use(morgan("tiny"));
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true }));

// --- IMPORTANT: raw body ONLY for /webhooks (HMAC)
app.use("/webhooks", bodyParser.raw({ type: "*/*" }));
// --- JSON for normal APIs
app.use(express.json());

// --- mount all routes
app.use(routes);

// --- error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({ error: "internal_error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => logger.info(`API listening on :${PORT}`));
