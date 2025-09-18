// discounts.js
import { shopifyGQL } from "./shopify.js";

/**
 * Create percentage/fixed discount code (cart-wide by default).
 * type: 'percentage' | 'fixed_amount'
 * value: number (e.g., 10 for 10%, 50000 for 50,000 IDR)
 */
export async function createDiscountCodeBasic({
  code,
  type,
  value,
  startsAt,
  endsAt,
}) {
  const mutation = `
    mutation CreateCode($input: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $input) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }
  `;

  const discount =
    type === "percentage"
      ? { percentage: { value: Number(value) } }
      : { fixedAmount: { amount: Number(value), appliesOnEachItem: false } };

  const input = {
    title: `LOYAL-${code}`,
    code,
    startsAt: startsAt || new Date().toISOString(),
    ...(endsAt ? { endsAt } : {}),
    customerSelection: { all: true },
    combinesWith: {
      productDiscounts: true,
      orderDiscounts: true,
      shippingDiscounts: true,
    },
    discount,
    // Optional examples you can enable later:
    // minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: "50000" } },
    // usageLimit: { oncePerCustomer: true, totalUsageLimit: 1 },
  };

  const data = await shopifyGQL(mutation, { input });
  const res = data.discountCodeBasicCreate;
  if (res.userErrors?.length) {
    const err = new Error("discount_create_failed");
    err.details = res.userErrors;
    throw err;
  }
  return res.codeDiscountNode.id; // store if you want to manage/disable later
}

/** Create FREE SHIPPING code */
export async function createDiscountCodeFreeShipping({
  code,
  startsAt,
  endsAt,
}) {
  const mutation = `
    mutation CreateFreeShip($input: DiscountCodeFreeShippingInput!) {
      discountCodeFreeShippingCreate(freeShippingCodeDiscount: $input) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }
  `;

  const input = {
    title: `LOYAL-${code}`,
    code,
    startsAt: startsAt || new Date().toISOString(),
    ...(endsAt ? { endsAt } : {}),
    customerSelection: { all: true },
    destinationSelection: { all: true }, // or restrict to certain countries/regions
    combinesWith: {
      productDiscounts: true,
      orderDiscounts: true,
      shippingDiscounts: true,
    },
  };

  const data = await shopifyGQL(mutation, { input });
  const res = data.discountCodeFreeShippingCreate;
  if (res.userErrors?.length) {
    const err = new Error("discount_create_failed");
    err.details = res.userErrors;
    throw err;
  }
  return res.codeDiscountNode.id;
}
