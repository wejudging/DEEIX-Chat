import assert from "node:assert/strict";
import test from "node:test";

import { resolveAccountPlanIdentity } from "./account-plan-identity.ts";

test("shows Free for a free account without usage balance", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: "free", subscriptionPlanName: "Free", billingBalanceNanousd: 0 }), "Free");
});

test("shows Paid for a free-tier account with usage balance", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: "free", subscriptionPlanName: "Free", billingBalanceNanousd: 1 }), "Paid");
});

test("prioritizes Pro over usage balance", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: "pro", subscriptionPlanName: "Pro", billingBalanceNanousd: 1 }), "Pro");
});

test("prioritizes Max over usage balance", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: "max", subscriptionPlanName: "Max", billingBalanceNanousd: 1 }), "Max");
});

test("uses an active paid plan name before usage balance when tier data lags", () => {
  assert.equal(resolveAccountPlanIdentity({ subscriptionTier: "free", subscriptionPlanName: "Pro", billingBalanceNanousd: 1 }), "Pro");
});
