"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Separator } from "@/components/ui/separator";
import { useSettingsBillingPage } from "@/features/settings/hooks/use-settings-billing-page";
import { useSettingsBillingUsageLog } from "@/features/settings/hooks/use-settings-billing-usage-log";
import { formatAccountBalance } from "@/features/settings/model/subscription-format";
import { useAuthSession } from "@/shared/auth/auth-session-context";
import { SettingsPage, SettingsSectionHeader } from "@/shared/components/settings-layout";
import { SubscriptionActivityHeatmapSkeleton } from "./subscription-activity-heatmap-skeleton";
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
  () => import("./subscription-activity-heatmap").then((module) => module.SubscriptionActivityHeatmap),
  {
    ssr: false,
    loading: () => <SubscriptionActivityHeatmapSkeleton />,
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

export function SettingsSubscription() {
  const t = useTranslations("settings.subscriptionPage");
  const { accessToken } = useAuthSession();
  const usageLog = useSettingsBillingUsageLog(accessToken);
  const {
    billingOverview,
    dailyUsage,
    monthlyUsage,
    billingLoading,
    billingDisplay,
    billingMode,
    billingAccount,
    epayLabels,
    epayTypes,
    paymentProviders,
    paymentDisabled,
    topUpAmount,
    setTopUpAmount,
    topUpLoading,
    selectedPaymentProvider,
    setSelectedPaymentProvider,
    selectedEPayType,
    setSelectedEPayType,
    topUp,
  } = useSettingsBillingPage(accessToken);
  const [usageView, setUsageView] = React.useState<UsageTrendView>("daily");
  const [topUpDialogOpen, setTopUpDialogOpen] = React.useState(false);
  const initialBillingActionHandledRef = React.useRef(false);

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

  return (
    <SettingsPage className="space-y-5 md:space-y-6">
      <SettingsSectionHeader title={t("title")} className="px-1" />

      <SubscriptionSummary
        billingMode={billingMode}
        billingLoading={billingLoading}
        topUpLoading={topUpLoading}
        paymentDisabled={paymentDisabled}
        billingOverview={billingOverview}
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
          items={usageLog.items}
          total={usageLog.total}
          loading={usageLog.loading}
          page={usageLog.page}
          pageSize={usageLog.pageSize}
          query={usageLog.query}
          status={usageLog.status}
          sort={usageLog.sort}
          billingDisplay={billingDisplay}
          onQueryChange={usageLog.changeQuery}
          onStatusChange={usageLog.changeStatus}
          onSortChange={usageLog.changeSort}
          onRefresh={usageLog.refresh}
          onPageChange={usageLog.setPage}
          onPageSizeChange={usageLog.changePageSize}
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
        onSubmit={() => void topUp()}
      />
    </SettingsPage>
  );
}
