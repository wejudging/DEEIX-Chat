"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useLocalizedErrorMessage } from "@/i18n/use-localized-error";
import {
  createBillingCheckout,
  getBillingConfig,
  getBillingOverview,
  listBillingDailyUsage,
  listBillingMonthlyUsage,
} from "@/shared/api/billing";
import type {
  BillingMode,
  BillingOverviewData,
  BillingUsageDailyDTO,
  BillingUsageMonthlyDTO,
} from "@/shared/api/billing-types";
import {
  normalizeBillingDisplayCurrency,
  type BillingDisplayOptions,
} from "@/entities/billing";
import { billingDisplayAmountToMinorUnits } from "@/features/settings/model/subscription-format";
import type { BillingRuntimeConfig } from "@/features/settings/hooks/use-settings-billing-overview";

type PaymentProvider = "stripe" | "epay";

/**
 * HOHAI 的「按量计费」页面数据层：配置、总览、用量趋势、充值下单都在这里，
 * 组件只负责渲染（上游架构检查要求组件不得直接调用请求函数）。
 */
export function useSettingsBillingPage(accessToken: string) {
  const t = useTranslations("settings.subscriptionPage");
  const resolveErrorMessage = useLocalizedErrorMessage();
  const [billingConfig, setBillingConfig] = React.useState<BillingRuntimeConfig | null>(null);
  const [billingOverview, setBillingOverview] = React.useState<BillingOverviewData["overview"] | null>(null);
  const [dailyUsage, setDailyUsage] = React.useState<BillingUsageDailyDTO[]>([]);
  const [monthlyUsage, setMonthlyUsage] = React.useState<BillingUsageMonthlyDTO[]>([]);
  const [billingLoading, setBillingLoading] = React.useState(true);
  const [topUpAmount, setTopUpAmount] = React.useState("20");
  const [topUpLoading, setTopUpLoading] = React.useState(false);
  const [selectedPaymentProvider, setSelectedPaymentProvider] = React.useState<PaymentProvider>("epay");
  const [selectedEPayType, setSelectedEPayType] = React.useState("alipay");

  React.useEffect(() => {
    let mounted = true;
    setBillingLoading(true);
    void Promise.all([
      getBillingConfig(accessToken),
      getBillingOverview(accessToken),
      listBillingDailyUsage(accessToken),
      listBillingMonthlyUsage(accessToken, 12),
    ])
      .then(([configData, overviewData, dailyUsageData, monthlyUsageData]) => {
        if (!mounted) return;
        setBillingConfig(configData.config);
        setBillingOverview(overviewData.overview);
        setDailyUsage(dailyUsageData ?? []);
        setMonthlyUsage(monthlyUsageData ?? []);
      })
      .catch((error) => {
        if (mounted) {
          toast.error(t("toasts.billingLoadFailed"), {
            description: resolveErrorMessage(error, t("toasts.retryLater")),
          });
        }
      })
      .finally(() => {
        if (mounted) setBillingLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [accessToken, resolveErrorMessage, t]);

  const epayLabels = React.useMemo(
    () => ({
      alipay: t("payment.epay.alipay"),
      wxpay: t("payment.epay.wxpay"),
      qqpay: t("payment.epay.qqpay"),
      custom: (type: string) => t("payment.epay.custom", { type }),
    }),
    [t],
  );
  const epayTypes = React.useMemo(() => {
    const values = billingConfig?.epayTypes?.filter((item) => item.type.trim()) ?? [];
    return values.length > 0
      ? values
      : [
          { name: epayLabels.alipay, type: "alipay" },
          { name: epayLabels.wxpay, type: "wxpay" },
        ];
  }, [billingConfig?.epayTypes, epayLabels.alipay, epayLabels.wxpay]);
  const paymentProviders = React.useMemo(
    () => billingConfig?.paymentProviders?.filter((item) => item === "stripe" || item === "epay") ?? [],
    [billingConfig?.paymentProviders],
  );

  React.useEffect(() => {
    if (paymentProviders.length > 0 && !paymentProviders.includes(selectedPaymentProvider)) {
      setSelectedPaymentProvider(paymentProviders[0] ?? "epay");
    }
  }, [paymentProviders, selectedPaymentProvider]);

  React.useEffect(() => {
    if (selectedPaymentProvider !== "epay") return;
    if (!epayTypes.some((item) => item.type === selectedEPayType)) {
      setSelectedEPayType(epayTypes[0]?.type ?? "alipay");
    }
  }, [epayTypes, selectedEPayType, selectedPaymentProvider]);

  const topUp = React.useCallback(async () => {
    const displayAmount = Number(topUpAmount);
    const amountMinorUnits = billingDisplayAmountToMinorUnits(displayAmount);
    if (!Number.isFinite(displayAmount) || displayAmount <= 0 || amountMinorUnits <= 0) {
      toast.error(t("toasts.invalidTopUpAmount"), { description: t("toasts.invalidTopUpAmountDescription") });
      return;
    }
    setTopUpLoading(true);
    try {
      const data = await createBillingCheckout(accessToken, {
        orderType: "topup",
        amountMinorUnits,
        cycles: 1,
        paymentProvider: selectedPaymentProvider,
        epayType: selectedPaymentProvider === "epay" ? selectedEPayType : undefined,
        successURL: `${window.location.origin}/settings/subscription?payment=success`,
        cancelURL: `${window.location.origin}/settings/subscription?payment=cancel`,
      });
      if (!data.checkout.checkoutURL) {
        toast.error(t("toasts.checkoutCreateFailed"), { description: t("toasts.checkoutURLMissing") });
        return;
      }
      window.open(data.checkout.checkoutURL, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(t("toasts.checkoutCreateFailed"), {
        description: resolveErrorMessage(error, t("toasts.retryLater")),
      });
    } finally {
      setTopUpLoading(false);
    }
  }, [accessToken, resolveErrorMessage, selectedEPayType, selectedPaymentProvider, t, topUpAmount]);

  const billingDisplay = React.useMemo<BillingDisplayOptions>(
    () => ({
      currency: normalizeBillingDisplayCurrency(billingConfig?.displayCurrency),
      usdToCnyRate: billingConfig?.usdToCNYRate ?? null,
    }),
    [billingConfig?.displayCurrency, billingConfig?.usdToCNYRate],
  );

  // HOHAI keeps the global mode on pay-as-you-go, but the per-user overview reports `period`
  // while a legacy subscription is still running so its remaining credit can be rendered.
  const billingMode: BillingMode = billingOverview?.mode ?? billingConfig?.mode ?? "self";

  return {
    billingConfig,
    billingOverview,
    dailyUsage,
    monthlyUsage,
    billingLoading,
    billingDisplay,
    billingMode,
    billingAccount: billingOverview?.account ?? null,
    epayLabels,
    epayTypes,
    paymentProviders,
    paymentDisabled: paymentProviders.length === 0,
    topUpAmount,
    setTopUpAmount,
    topUpLoading,
    selectedPaymentProvider,
    setSelectedPaymentProvider,
    selectedEPayType,
    setSelectedEPayType,
    topUp,
  };
}
