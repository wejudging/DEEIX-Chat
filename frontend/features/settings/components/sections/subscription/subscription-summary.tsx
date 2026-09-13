"use client";

import * as React from "react";
import { Banknote } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatAccountBalance } from "@/features/settings/model/subscription-format";
import type { BillingOverviewData } from "@/shared/api/billing.types";
import type { BillingDisplayOptions } from "@/shared/lib/billing-display";

type BillingMode = "period" | "usage" | "self";
type BillingAccount = NonNullable<BillingOverviewData["overview"]>["account"];

function ActionRow({
  title,
  value,
  description,
  action,
}: {
  title: string;
  value?: string;
  description?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium">{title}</p>
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
  billingAccount: BillingAccount | null;
  billingDisplay: BillingDisplayOptions;
  onOpenTopUpDialog: () => void;
};

export function SubscriptionSummary({
  billingMode,
  billingLoading,
  topUpLoading,
  paymentDisabled,
  billingAccount,
  billingDisplay,
  onOpenTopUpDialog,
}: SubscriptionSummaryProps) {
  const t = useTranslations("settings.subscriptionPage");

  if (billingMode === "self") {
    return (
      <section className="space-y-6 px-0.5 md:space-y-7 xl:space-y-8 xl:px-1">
        <ValueRow title={t("selfMode.title")} value={t("selfMode.value")} />
      </section>
    );
  }

  // HOHAI retired customer-facing subscription plans: usage billing and any legacy period
  // subscription now render the same pay-as-you-go balance row with a top-up action.
  return (
    <section className="space-y-6 px-0.5 md:space-y-7 xl:space-y-8 xl:px-1">
      <ActionRow
        title={t("usageBilling.title")}
        value={t("usageBilling.balance", { value: formatAccountBalance(billingAccount?.balanceUSD ?? 0, billingDisplay) })}
        description={t("usageBilling.description")}
        action={
          <Button type="button" disabled={billingLoading || topUpLoading || paymentDisabled} onClick={onOpenTopUpDialog}>
            <Banknote className="size-3.5" />
            {t("usageBilling.topUp")}
          </Button>
        }
      />
    </section>
  );
}
