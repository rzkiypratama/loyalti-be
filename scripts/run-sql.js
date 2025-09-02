import fs from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const [, , fileArg] = process.argv;
if (!fileArg) {
  console.error("Usage: node scripts/run-sql.js <path-to-sql>");
  process.exit(1);
}

const sqlPath = fileArg.startsWith("/")
  ? fileArg
  : `${__dirname}/../${fileArg}`;
const sql = fs.readFileSync(sqlPath, "utf8");

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`Ran SQL: ${fileArg}`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("SQL error:", e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
