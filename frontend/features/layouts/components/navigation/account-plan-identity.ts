export type AccountPlanIdentity = "Free" | "Paid" | "Pro" | "Max";

export function resolveAccountPlanIdentity({
  subscriptionTier,
  subscriptionPlanName,
  billingBalanceNanousd,
}: {
  subscriptionTier: string | null | undefined;
  subscriptionPlanName: string | null | undefined;
  billingBalanceNanousd: number | null | undefined;
}): AccountPlanIdentity {
  const tier = subscriptionTier?.trim().toLowerCase() ?? "";
  const planName = subscriptionPlanName?.trim().toLowerCase() ?? "";
  const paidPlan = `${tier} ${planName}`;

  const hasPaidSubscription = (tier !== "" && tier !== "free") || planName === "pro" || planName === "max";

  if (hasPaidSubscription) {
    return paidPlan.includes("max") ? "Max" : "Pro";
  }
  if ((billingBalanceNanousd ?? 0) > 0) {
    return "Paid";
  }
  return "Free";
}
