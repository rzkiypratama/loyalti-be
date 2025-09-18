// shopify.js
import fetch from "node-fetch";

const API_VER = process.env.SHOPIFY_API_VERSION || "2025-07";
const DOMAIN = process.env.SHOP_DOMAIN;
const TOKEN = process.env.SHOP_ACCESS_TOKEN;

export async function shopifyGQL(query, variables) {
  const r = await fetch(`https://${DOMAIN}/admin/api/${API_VER}/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (!r.ok || j.errors) {
    const err = new Error("shopify_graphql_failed");
    err.status = r.status || 500;
    err.details = j;
    throw err;
  }
  return j.data;
}
