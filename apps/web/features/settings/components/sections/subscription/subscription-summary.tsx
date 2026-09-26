"use client";

import * as React from "react";
import { BadgeCheck, Banknote } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  formatAccountBalance,
  formatMediumDate,
  formatPlanCredit,
} from "@/features/settings/model/subscription-format";
import type { BillingOverviewData } from "@/shared/api/billing.types";
import type { BillingDisplayOptions } from "@/shared/lib/billing-display";

type BillingMode = "period" | "usage" | "self";
type BillingOverview = BillingOverviewData["overview"];

function ActionRow({
  title,
  value,
  description,
  action,
}: {
  title?: string;
  value?: string;
  description?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        {title ? <p className="text-xs font-medium">{title}</p> : null}
        {value ? <p className="break-words text-sm font-medium text-foreground/85">{value}</p> : null}
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="self-start sm:self-auto sm:justify-self-end">{action}</div>
    </div>
  );
}

function ValueRow({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-medium">{title}</p>
      <div className="flex min-w-0 max-w-full items-center gap-2 self-start rounded-lg bg-muted/35 px-2 py-1 text-xs text-muted-foreground sm:self-auto">
        <span className="max-w-[min(75vw,26rem)] truncate">{value}</span>
      </div>
    </div>
  );
}

type SubscriptionSummaryProps = {
  billingMode: BillingMode;
  billingLoading: boolean;
  topUpLoading: boolean;
  paymentDisabled: boolean;
  billingOverview: BillingOverview | null;
  billingDisplay: BillingDisplayOptions;
  onOpenTopUpDialog: () => void;
};

export function SubscriptionSummary({
  billingMode,
  billingLoading,
  topUpLoading,
  paymentDisabled,
  billingOverview,
  billingDisplay,
  onOpenTopUpDialog,
}: SubscriptionSummaryProps) {
  const t = useTranslations("settings.subscriptionPage");
  const locale = useLocale();

  if (billingMode === "self") {
    return (
      <section className="space-y-6 px-0.5 md:space-y-7 xl:space-y-8 xl:px-1">
        <ValueRow title={t("selfMode.title")} value={t("selfMode.value")} />
      </section>
    );
  }

  const billingAccount = billingOverview?.account ?? null;
  const topUpAction = (
    <Button type="button" disabled={billingLoading || topUpLoading || paymentDisabled} onClick={onOpenTopUpDialog}>
      <Banknote className="size-3.5" />
      {t("usageBilling.topUp")}
    </Button>
  );
  const balanceRow = (
    <ActionRow
      value={
        t("usageBilling.balance", {
          value: formatAccountBalance(billingAccount?.balanceUSD ?? 0, billingDisplay),
        })
      }
      description={t("usageBilling.description")}
      action={topUpAction}
    />
  );

  // HOHAI keeps selling top-ups only, but subscribers that bought a plan while subscriptions were
  // still on sale keep consuming the plan credit they already paid for. They get a compact plan
  // card above the regular balance row so the remaining credit stays visible until it expires.
  const currentEntitlement =
    billingMode === "period"
      ? (billingOverview?.subscriptionEntitlements?.find((item) => item.isCurrent) ??
        billingOverview?.subscriptionEntitlements?.[0] ??
        null)
      : null;

  if (billingMode === "period" && currentEntitlement) {
    const planName =
      currentEntitlement.plan.name?.trim() || currentEntitlement.plan.code.trim().toUpperCase();
    const remainingCredit = formatPlanCredit(billingOverview?.periodRemainingUSD ?? 0, billingDisplay);
    const totalCredit = formatPlanCredit(billingOverview?.periodCreditUSD ?? 0, billingDisplay);
    const expiresAt = formatMediumDate(currentEntitlement.currentPeriodEndAt, locale);

    return (
      <section className="space-y-6 px-0.5 md:space-y-7 xl:space-y-8 xl:px-1">
        <div className="space-y-3 rounded-xl bg-muted/35 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <BadgeCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-semibold text-foreground">{planName}</span>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              {t("legacyPlan.status")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-background/70 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{t("legacyPlan.remaining")}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                {remainingCredit} / {totalCredit}
              </p>
            </div>
            <div className="rounded-lg bg-background/70 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{t("legacyPlan.expiresAt")}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{expiresAt}</p>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("legacyPlan.note")}</p>
        </div>
        {balanceRow}
      </section>
    );
  }

  return (
    <section className="space-y-6 px-0.5 md:space-y-7 xl:space-y-8 xl:px-1">
      {/* HOHAI: the page header already renders “按量计费”, so the card starts at the balance
          line — do not reintroduce a second usage-billing title here. */}
      {balanceRow}
    </section>
  );
}
