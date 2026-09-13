import assert from "node:assert/strict";
import test from "node:test";

import { resolveAccountPlanIdentity } from "./account-plan-identity.ts";

test("shows Free for a free account without usage balance", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: "free", subscriptionPlanName: "Free", billingBalanceNanousd: 0 }), "Free");
});

test("shows Paid for a free-tier account with usage balance", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: "free", subscriptionPlanName: "Free", billingBalanceNanousd: 1 }), "Paid");
});

test("shows Paid for an active paid subscription tier", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: "pro", subscriptionPlanName: "Pro", billingBalanceNanousd: 1 }), "Paid");
});

test("shows Paid for a legacy higher tier without usage balance", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: "max", subscriptionPlanName: "Max", billingBalanceNanousd: 0 }), "Paid");
});

test("uses an active paid plan name before usage balance when tier data lags", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: "free", subscriptionPlanName: "Pro", billingBalanceNanousd: 1 }), "Paid");
});

test("keeps Free when the plan name is the free plan", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: "free", subscriptionPlanName: "Free", billingBalanceNanousd: 0 }), "Free");
});

test("keeps Free when identity data is missing entirely", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: null, subscriptionPlanName: null, billingBalanceNanousd: null }), "Free");
});
