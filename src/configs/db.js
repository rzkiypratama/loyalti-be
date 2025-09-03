import pg from "pg";
const { Pool } = pg;

console.log(
  "[BOOT] NODE_ENV=%s  PORT=%s  DB=%s  SECRET_LEN=%d",
  process.env.NODE_ENV,
  process.env.PORT,
  (process.env.DATABASE_URL || "").replace(/:\/\/.*@/, "://***@"),
  (process.env.SHOPIFY_WEBHOOK_SECRET || "").trim().length
);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

export async function query(sql, params) {
  const res = await pool.query(sql, params);
  return res.rows;
}
