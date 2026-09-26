"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SpinnerLabel } from "@/components/ui/spinner";
import {
  billingDisplayAmountToUSD,
  billingDisplayInputSymbol,
  formatProviderPaymentAmountFromUSD,
} from "@/features/settings/model/subscription-format";
import type { BillingDisplayOptions } from "@/shared/lib/billing-display";

type PaymentProvider = "stripe" | "epay";

type EPayTypeOption = {
  name: string;
  type: string;
};

function resolveEPayTypeLabel(type: string, labels: { alipay: string; wxpay: string; qqpay: string; custom: (type: string) => string }): string {
  if (type === "alipay") return labels.alipay;
  if (type === "wxpay") return labels.wxpay;
  if (type === "qqpay") return labels.qqpay;
  return labels.custom(type);
}

function resolvePaymentBrandMark(provider: PaymentProvider, epayType: string): ReactNode {
  // Alipay shows the official blue mark; other channels stay text-only so the row keeps
  // the dialog's neutral styling.
  if (provider === "epay" && epayType === "alipay") {
    return <img src="/branding/alipay.svg" alt="" aria-hidden="true" className="size-4 shrink-0 rounded-[3px]" />;
  }
  return null;
}

type TopUpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  currentBalance: string;
  billingLoading: boolean;
  topUpLoading: boolean;
  paymentDisabled: boolean;
  paymentProviders: string[];
  selectedPaymentProvider: PaymentProvider;
  selectedEPayType: string;
  epayTypes: EPayTypeOption[];
  billingDisplay: BillingDisplayOptions;
  epayLabels: {
    alipay: string;
    wxpay: string;
    qqpay: string;
    custom: (type: string) => string;
  };
  onAmountChange: (value: string) => void;
  onPaymentProviderChange: (provider: PaymentProvider) => void;
  onEPayTypeChange: (type: string) => void;
  onSubmit: () => void;
};

export function TopUpDialog({
  open,
  onOpenChange,
  amount,
  currentBalance,
  billingLoading,
  topUpLoading,
  paymentDisabled,
  paymentProviders,
  selectedPaymentProvider,
  selectedEPayType,
  epayTypes,
  billingDisplay,
  epayLabels,
  onAmountChange,
  onPaymentProviderChange,
  onEPayTypeChange,
  onSubmit,
}: TopUpDialogProps) {
  const t = useTranslations("settings.subscriptionPage");
  const displayAmount = Number(amount);
  const paymentAmountUSD = billingDisplayAmountToUSD(displayAmount, billingDisplay);
  const stripePaymentAmount = formatProviderPaymentAmountFromUSD(paymentAmountUSD, "stripe", billingDisplay);
  const epayPaymentAmount = formatProviderPaymentAmountFromUSD(paymentAmountUSD, "epay", billingDisplay);
  const inputSymbol = billingDisplayInputSymbol(billingDisplay);
  const disabled = billingLoading || topUpLoading || paymentDisabled;

  const paymentOptions: { key: string; label: string; amount: string; selected: boolean; mark: ReactNode; select: () => void }[] = [];
  if (paymentProviders.includes("stripe")) {
    paymentOptions.push({
      key: "stripe",
      label: "Stripe",
      amount: stripePaymentAmount,
      selected: selectedPaymentProvider === "stripe",
      mark: resolvePaymentBrandMark("stripe", ""),
      select: () => onPaymentProviderChange("stripe"),
    });
  }
  if (paymentProviders.includes("epay")) {
    for (const item of epayTypes) {
      paymentOptions.push({
        key: `epay-${item.type}`,
        label: item.name || resolveEPayTypeLabel(item.type, epayLabels),
        amount: epayPaymentAmount,
        selected: selectedPaymentProvider === "epay" && selectedEPayType === item.type,
        mark: resolvePaymentBrandMark("epay", item.type),
        select: () => {
          onPaymentProviderChange("epay");
          onEPayTypeChange(item.type);
        },
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t("topUp.title")}</DialogTitle>
          <DialogDescription>{t("topUp.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{t("topUp.amount")}</p>
            <p className="truncate text-xs text-muted-foreground tabular-nums">
              {t("topUp.currentBalance", { value: currentBalance })}
            </p>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{inputSymbol}</span>
            <Input
              value={amount}
              type="number"
              min="0"
              step="0.01"
              className="pl-7"
              onChange={(event) => onAmountChange(event.target.value)}
              disabled={disabled}
              aria-label={t("topUp.amountAria")}
            />
          </div>
        </div>

        {!paymentDisabled && paymentOptions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("payment.method")}</p>
            <div className={paymentOptions.length > 1 ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>
              {paymentOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    option.selected
                      ? "border-foreground bg-muted/25 font-medium"
                      : "border-border bg-transparent text-muted-foreground hover:bg-muted/20"
                  }`}
                  disabled={disabled}
                  onClick={option.select}
                >
                  {option.mark}
                  <span className="truncate">{option.label}</span>
                  <span className="shrink-0 text-xs font-normal tabular-nums opacity-80">{option.amount}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={topUpLoading}>
            {t("actions.cancel")}
          </Button>
          <Button type="button" disabled={disabled} onClick={onSubmit}>
            {topUpLoading ? <SpinnerLabel>{t("actions.processing")}</SpinnerLabel> : t("topUp.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
