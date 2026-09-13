"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Separator } from "@/components/ui/separator";
import {
  billingDisplayAmountToMinorUnits,
  formatAccountBalance,
} from "@/features/settings/model/subscription-format";
import { useLocalizedErrorMessage } from "@/i18n/use-localized-error";
import {
  createBillingCheckout,
  getBillingConfig,
  getBillingOverview,
  listBillingDailyUsage,
  listBillingMonthlyUsage,
  listBillingUsage,
} from "@/shared/api/billing";
import type {
  BillingConfigData,
  BillingMode,
  BillingOverviewData,
  BillingUsageDailyDTO,
  BillingUsageLedgerDTO,
  BillingUsageMonthlyDTO,
} from "@/shared/api/billing.types";
import { useAuthSession } from "@/shared/auth/auth-session-context";
import { SettingsPage, SettingsSectionHeader } from "@/shared/components/settings-layout";
import {
  type BillingDisplayOptions,
  normalizeBillingDisplayCurrency,
} from "@/shared/lib/billing-display";
import { ActivityHeatmapSkeleton } from "./activity-heatmap-skeleton";
import { TopUpDialog } from "./subscription-billing-dialogs";
import { SubscriptionSummary } from "./subscription-summary";
import type { UsageTrendView } from "./subscription-trend";
import { SubscriptionUsageLog } from "./subscription-usage-log";

const SubscriptionTrend = dynamic(
  () => import("./subscription-trend").then((module) => module.SubscriptionTrend),
  {
    ssr: false,
    loading: () => <SubscriptionTrendSkeleton />,
  },
);

const SubscriptionActivityHeatmap = dynamic(
  () => import("./activity-heatmap").then((module) => module.SubscriptionActivityHeatmap),
  {
    ssr: false,
    loading: () => <ActivityHeatmapSkeleton />,
  },
);

function SubscriptionTrendSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex h-9 items-center justify-between gap-3">
        <div className="h-4 w-28 rounded-full bg-muted/50" />
        <div className="h-7 w-24 rounded-full bg-muted/50" />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`subscription-trend-skeleton-${index}`} className="rounded-md bg-muted/40 p-3">
            <div className="h-3 w-16 rounded-full bg-muted/60" />
            <div className="mt-2 h-4 w-20 rounded-full bg-muted/60" />
          </div>
        ))}
      </div>
      <div className="rounded-md bg-muted/35 p-3">
        <div className="h-[260px] rounded-md bg-muted/30" />
      </div>
    </div>
  );
}

type BillingRuntimeConfig = BillingConfigData["config"];
type PaymentProvider = "stripe" | "epay";

export function SettingsSubscription() {
  const t = useTranslations("settings.subscriptionPage");
  const resolveErrorMessage = useLocalizedErrorMessage();
  const { accessToken } = useAuthSession();
  const [billingConfig, setBillingConfig] = React.useState<BillingRuntimeConfig | null>(null);
  const [billingOverview, setBillingOverview] = React.useState<BillingOverviewData["overview"] | null>(null);
  const [usageLedgers, setUsageLedgers] = React.useState<BillingUsageLedgerDTO[]>([]);
  const [dailyUsage, setDailyUsage] = React.useState<BillingUsageDailyDTO[]>([]);
  const [monthlyUsage, setMonthlyUsage] = React.useState<BillingUsageMonthlyDTO[]>([]);
  const [usageTotal, setUsageTotal] = React.useState(0);
  const [usagePage, setUsagePage] = React.useState(1);
  const [usagePageSize, setUsagePageSize] = React.useState(25);
  const [usageQuery, setUsageQuery] = React.useState("");
  const [usageStatus, setUsageStatus] = React.useState("");
  const [usageSort, setUsageSort] = React.useState("newest");
  const [usageView, setUsageView] = React.useState<UsageTrendView>("daily");
  const [billingLoading, setBillingLoading] = React.useState(true);
  const [usageLoading, setUsageLoading] = React.useState(true);
  const [topUpAmount, setTopUpAmount] = React.useState("20");
  const [topUpLoading, setTopUpLoading] = React.useState(false);
  const [selectedPaymentProvider, setSelectedPaymentProvider] = React.useState<PaymentProvider>("epay");
  const [selectedEPayType, setSelectedEPayType] = React.useState("alipay");
  const [topUpDialogOpen, setTopUpDialogOpen] = React.useState(false);
  const initialBillingActionHandledRef = React.useRef(false);
  const billingMode: BillingMode = billingConfig?.mode ?? "self";
  const billingDisplay = React.useMemo<BillingDisplayOptions>(
    () => ({
      currency: normalizeBillingDisplayCurrency(billingConfig?.displayCurrency),
      usdToCnyRate: billingConfig?.usdToCNYRate ?? null,
    }),
    [billingConfig?.displayCurrency, billingConfig?.usdToCNYRate],
  );

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
        if (mounted) toast.error(t("toasts.billingLoadFailed"), { description: resolveErrorMessage(error, t("toasts.retryLater")) });
      })
      .finally(() => {
        if (mounted) setBillingLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [accessToken, resolveErrorMessage, t]);

  React.useEffect(() => {
    if (billingLoading || initialBillingActionHandledRef.current) return;
    initialBillingActionHandledRef.current = true;
    const url = new URL(window.location.href);
    const action = url.searchParams.get("action");
    // "plans" is a legacy link target from the retired subscription flow; both actions now open
    // the top-up dialog because HOHAI only bills by usage.
    if (action === "topup" || action === "plans") {
      setTopUpDialogOpen(true);
      url.searchParams.delete("action");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [billingLoading]);

  const loadUsageLogs = React.useCallback(async (page: number, pageSize: number, query: string, status: string, sort: string) => {
    setUsageLoading(true);
    try {
      const usage = await listBillingUsage(accessToken, { page, pageSize, query, status, sort });
      setUsageLedgers(usage.results ?? []);
      setUsageTotal(usage.total ?? 0);
    } catch (error) {
      toast.error(t("toasts.usageLogLoadFailed"), { description: resolveErrorMessage(error, t("toasts.retryLater")) });
    } finally {
      setUsageLoading(false);
    }
  }, [accessToken, resolveErrorMessage, t]);

  React.useEffect(() => {
    void loadUsageLogs(usagePage, usagePageSize, usageQuery, usageStatus, usageSort);
  }, [loadUsageLogs, usagePage, usagePageSize, usageQuery, usageStatus, usageSort]);

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
    return values.length > 0 ? values : [{ name: epayLabels.alipay, type: "alipay" }, { name: epayLabels.wxpay, type: "wxpay" }];
  }, [billingConfig?.epayTypes, epayLabels.alipay, epayLabels.wxpay]);
  const paymentProviders = React.useMemo(() => billingConfig?.paymentProviders?.filter((item) => item === "stripe" || item === "epay") ?? [], [billingConfig?.paymentProviders]);

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

  const handleTopUp = React.useCallback(async () => {
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
        successURL: `${window.location.origin}/setting/subscription?payment=success`,
        cancelURL: `${window.location.origin}/setting/subscription?payment=cancel`,
      });
      if (!data.checkout.checkoutURL) {
        toast.error(t("toasts.checkoutCreateFailed"), { description: t("toasts.checkoutURLMissing") });
        return;
      }
      window.open(data.checkout.checkoutURL, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(t("toasts.checkoutCreateFailed"), { description: resolveErrorMessage(error, t("toasts.retryLater")) });
    } finally {
      setTopUpLoading(false);
    }
  }, [accessToken, resolveErrorMessage, selectedEPayType, selectedPaymentProvider, t, topUpAmount]);

  const paymentDisabled = paymentProviders.length === 0;
  const billingAccount = billingOverview?.account ?? null;

  return (
    <SettingsPage className="space-y-5 md:space-y-6">
      <SettingsSectionHeader title={t("title")} className="px-1" />

      <SubscriptionSummary
        billingMode={billingMode}
        billingLoading={billingLoading}
        topUpLoading={topUpLoading}
        paymentDisabled={paymentDisabled}
        billingAccount={billingAccount}
        billingDisplay={billingDisplay}
        onOpenTopUpDialog={() => setTopUpDialogOpen(true)}
      />

      <section className="space-y-6 px-0.5 md:space-y-7 xl:space-y-8 xl:px-1">
        <Separator />
        <SubscriptionActivityHeatmap accessToken={accessToken} />
        <Separator />
        <SubscriptionTrend
          dailyUsage={dailyUsage}
          monthlyUsage={monthlyUsage}
          loading={billingLoading}
          view={usageView}
          billingDisplay={billingDisplay}
          onViewChange={setUsageView}
        />
        <Separator />
        <SubscriptionUsageLog
          items={usageLedgers}
          total={usageTotal}
          loading={usageLoading}
          page={usagePage}
          pageSize={usagePageSize}
          query={usageQuery}
          status={usageStatus}
          sort={usageSort}
          billingDisplay={billingDisplay}
          onQueryChange={(value) => {
            setUsageQuery(value);
            setUsagePage(1);
          }}
          onStatusChange={(value) => {
            setUsageStatus(value);
            setUsagePage(1);
          }}
          onSortChange={(value) => {
            setUsageSort(value);
            setUsagePage(1);
          }}
          onRefresh={() => void loadUsageLogs(usagePage, usagePageSize, usageQuery, usageStatus, usageSort)}
          onPageChange={setUsagePage}
          onPageSizeChange={(nextPageSize) => {
            setUsagePageSize(nextPageSize);
            setUsagePage(1);
          }}
        />
      </section>

      <TopUpDialog
        open={topUpDialogOpen}
        onOpenChange={setTopUpDialogOpen}
        amount={topUpAmount}
        currentBalance={formatAccountBalance(billingAccount?.balanceUSD ?? 0, billingDisplay)}
        billingLoading={billingLoading}
        topUpLoading={topUpLoading}
        paymentDisabled={paymentDisabled}
        paymentProviders={paymentProviders}
        selectedPaymentProvider={selectedPaymentProvider}
        selectedEPayType={selectedEPayType}
        epayTypes={epayTypes}
        billingDisplay={billingDisplay}
        epayLabels={epayLabels}
        onAmountChange={setTopUpAmount}
        onPaymentProviderChange={setSelectedPaymentProvider}
        onEPayTypeChange={setSelectedEPayType}
        onSubmit={() => void handleTopUp()}
      />
    </SettingsPage>
  );
}
