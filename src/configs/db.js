import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

console.log("[DB] using", process.env.DATABASE_URL);

export async function query(sql, params) {
  const res = await pool.query(sql, params);
  return res.rows;
}
