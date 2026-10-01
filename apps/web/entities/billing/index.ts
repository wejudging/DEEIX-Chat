// Public entry of the billing entity; code outside entities/billing/ imports only this file.
// Unused re-exports are tree-shaken (package.json "sideEffects"), so UI and logic share one entry.
export {
  type BillingDisplayCurrency,
  type BillingDisplayLabels,
  type BillingDisplayOptions,
  billingRateMultiplierNote,
  cacheWriteBillingLabel,
  cacheWriteBillingNote,
  cacheWritePricingLabel,
  cacheWritePricingNote,
  formatBillingDisplayAmountFromUSD,
  formatBillingDisplayBalanceFromUSD,
  formatBillingDisplayCompactAmountFromUSD,
  formatBillingDisplayPreciseAmountFromUSD,
  formatBillingDisplayUnitPriceFromUSD,
  normalizeBillingDisplayCurrency,
  resolveCacheWritePricingUSD,
} from "@/entities/billing/lib/billing-display";
