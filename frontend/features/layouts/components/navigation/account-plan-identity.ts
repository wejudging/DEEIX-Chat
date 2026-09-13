export type AccountPlanIdentity = "Free" | "Paid";

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

  // HOHAI only exposes two customer identities: Free (no paid plan, no balance) and Paid
  // (either an active paid plan or a positive usage balance). Plan names are intentionally
  // not surfaced here so the sidebar stays stable when subscription plans are retired.
  const hasPaidSubscription =
    (tier !== "" && tier !== "free") || (planName !== "" && planName !== "free");

  if (hasPaidSubscription) {
    return "Paid";
  }
  if ((billingBalanceNanousd ?? 0) > 0) {
    return "Paid";
  }
  return "Free";
}
