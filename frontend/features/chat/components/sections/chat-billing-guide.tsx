"use client";

import { Banknote, CreditCard, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function NewChatBillingNotice({
  balanceLabel,
  onDismiss,
  onUpgrade,
}: {
  balanceLabel: string;
  onDismiss: () => void;
  onUpgrade: () => void;
}) {
  const t = useTranslations("chat.billingGuide");

  return (
    <div className="flex max-w-full items-center gap-1 rounded-md border border-border/50 bg-muted/70 p-1 pl-2 text-xs text-muted-foreground shadow-xs">
      <Sparkles className="size-3.5 shrink-0 text-primary" />
      <span className="truncate px-1">{t("newChatStatus", { balance: balanceLabel })}</span>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className="h-6 shrink-0 px-2 text-primary hover:text-primary"
        onClick={onUpgrade}
      >
        {t("upgrade")}
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="size-6 shrink-0 text-muted-foreground"
        onClick={onDismiss}
        aria-label={t("dismiss")}
        title={t("dismiss")}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

export function PaidModelBillingDialog({
  open,
  modelName,
  onOpenChange,
  onTopUp,
  onViewPlans,
}: {
  open: boolean;
  modelName: string;
  onOpenChange: (open: boolean) => void;
  onTopUp: () => void;
  onViewPlans: () => void;
}) {
  const t = useTranslations("chat.billingGuide");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            {t("paidModelTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("paidModelDescription", { model: modelName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" size="sm" onClick={onTopUp}>
            <Banknote className="size-3.5" />
            {t("topUp")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onViewPlans}>
            <CreditCard className="size-3.5" />
            {t("viewPlans")}
          </Button>
        </div>
        <AlertDialogFooter className="justify-stretch">
          <AlertDialogCancel className="w-full">{t("keepFree")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
