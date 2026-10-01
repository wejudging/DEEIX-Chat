"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { resolveAccountPlanIdentity } from "@/features/shell/components/navigation/account-plan-identity";
import {
  formatBillingDisplayBalanceFromUSD,
  normalizeBillingDisplayCurrency,
  type BillingDisplayOptions,
} from "@/entities/billing";
import { getBillingConfig } from "@/shared/api/billing";
import { useAuthSession } from "@/shared/auth/auth-session-context";

/**
 * 侧边栏用户条目上的身份与余额：套餐标签（免费 / 付费）与余额数字。
 * 请求放在 hook 里，组件只渲染（上游架构检查要求组件不得直接调用请求函数）。
 */
export function useShellBillingIdentity() {
  const t = useTranslations("common.navigation");
  const { user: sessionUser, accessToken } = useAuthSession();
  const [billingDisplay, setBillingDisplay] = React.useState<BillingDisplayOptions>(() => ({
    currency: normalizeBillingDisplayCurrency(sessionUser?.billingAccountCurrency),
  }));

  React.useEffect(() => {
    if (!accessToken) return;
    let active = true;
    void getBillingConfig(accessToken)
      .then(({ config }) => {
        if (!active) return;
        setBillingDisplay({
          currency: normalizeBillingDisplayCurrency(config.displayCurrency),
          usdToCnyRate: config.usdToCNYRate,
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [accessToken]);

  const planIdentity = resolveAccountPlanIdentity({
    subscriptionTier: sessionUser?.subscriptionTier,
    subscriptionPlanName: sessionUser?.subscriptionPlanName,
    billingBalanceNanousd: sessionUser?.billingBalanceNanousd,
  });

  return {
    sessionUser,
    // Keep the identity names in English when the customer picked English, and translate them
    // for Chinese users (免费 / 付费); HOHAI only exposes these two identities.
    planLabel: t(planIdentity === "Paid" ? "paidPlan" : "freePlan"),
    balanceLabel: formatBillingDisplayBalanceFromUSD(sessionUser?.billingBalanceUSD ?? 0, billingDisplay),
  };
}
