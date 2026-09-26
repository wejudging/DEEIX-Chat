"use client";

import * as React from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeightTransition,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SpinnerLabel } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ALL_TIME_PRICING_WEEKDAYS,
  createTimePricingCampaignForm,
  createTimePricingPeriodForm,
  createTimePricingWindowForm,
  DEFAULT_TIME_PRICING_TIMEZONE,
  emptyTimePricingFormState,
  isTimePricingFormValid,
  normalizePricingMode,
  parsePrice,
  parseTieredPricingJSON,
  parseTimePricingJSON,
  stringifyTieredPricing,
  stringifyTimePricing,
  type PlanFormState,
  type PricingMode,
  type PricingFormState,
  type TimePricingCampaignForm,
  type TimePricingFormState,
  type TimePricingPeriodForm,
  type TimePricingWindowForm,
  type TieredPricingTierForm,
} from "@/features/admin/model/billing-settings";
import type { PermissionGroup } from "@/features/admin/api/permission-groups";

type PricingJSONValue = Record<string, unknown>;

function timePricingFormToJSONValue(form: TimePricingFormState): unknown | null {
  if (form.periods.length === 0 && form.campaigns.length === 0) {
    return null;
  }
  return JSON.parse(stringifyTimePricing(form)) as unknown;
}

function pricingFormToJSON(form: PricingFormState): string {
  const pricingMode = normalizePricingMode(form.pricingMode);
  const timePricing = timePricingFormToJSONValue(form.timePricing);
  const payload = {
    platformModelName: form.platformModelName,
    currency: "USD",
    isFree: form.isFree,
    pricingMode,
    inputUSDPerMTokens: pricingMode === "token" ? parsePrice(form.input) : 0,
    cacheReadUSDPerMTokens: pricingMode === "token" ? parsePrice(form.cacheRead) : 0,
    cacheWriteUSDPerMTokens: pricingMode === "token" ? parsePrice(form.cacheWrite) : 0,
    cacheWritePriceBasis: form.cacheWritePriceBasis,
    outputUSDPerMTokens: pricingMode === "token" ? parsePrice(form.output) : 0,
    callUSDPerCall: pricingMode === "call" ? parsePrice(form.call) : 0,
    durationUSDPerSecond: pricingMode === "duration" ? parsePrice(form.duration) : 0,
    ...(pricingMode === "tiered" ? { tieredPricing: JSON.parse(stringifyTieredPricing(form.tieredTiers)) as unknown } : {}),
    ...(timePricing ? { timePricing } : {}),
  };
  return JSON.stringify(payload, null, 2);
}

function readPricingNumber(payload: PricingJSONValue, key: string): string {
  const value = payload[key];
  if (value === undefined || value === null || value === "") {
    return "0";
  }
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "0";
}

function readPricingMode(value: unknown): PricingMode | null {
  return value === "token" || value === "call" || value === "duration" || value === "tiered" ? value : null;
}

function pricingFormFromJSON(
  current: PricingFormState,
  raw: string,
  durationPricingEnabled: boolean,
  messages: { root: string; model: string; mode: string; durationVideoOnly: string; tiered: string; timePricing: string },
): PricingFormState {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(messages.root);
  }
  const payload = parsed as PricingJSONValue;
  const platformModelName = typeof payload.platformModelName === "string" ? payload.platformModelName.trim() : current.platformModelName;
  if (platformModelName !== current.platformModelName) {
    throw new Error(messages.model);
  }
  const pricingMode = readPricingMode(payload.pricingMode);
  if (!pricingMode) {
    throw new Error(messages.mode);
  }
  if (pricingMode === "duration" && !durationPricingEnabled) {
    throw new Error(messages.durationVideoOnly);
  }
  const cacheWritePriceBasis = payload.cacheWritePriceBasis;
  if (cacheWritePriceBasis !== undefined && cacheWritePriceBasis !== "direct" && cacheWritePriceBasis !== "anthropic_5m") {
    throw new Error(messages.root);
  }
  const next: PricingFormState = {
    ...current,
    pricingMode,
    cacheWritePriceBasis,
    isFree: typeof payload.isFree === "boolean" ? payload.isFree : current.isFree,
    input: pricingMode === "token" ? readPricingNumber(payload, "inputUSDPerMTokens") : "0",
    cacheRead: pricingMode === "token" ? readPricingNumber(payload, "cacheReadUSDPerMTokens") : "0",
    cacheWrite: pricingMode === "token" ? readPricingNumber(payload, "cacheWriteUSDPerMTokens") : "0",
    output: pricingMode === "token" ? readPricingNumber(payload, "outputUSDPerMTokens") : "0",
    call: pricingMode === "call" ? readPricingNumber(payload, "callUSDPerCall") : "0",
    duration: pricingMode === "duration" ? readPricingNumber(payload, "durationUSDPerSecond") : "0",
  };
  if (pricingMode === "tiered") {
    const tiers = parseTieredPricingJSON(payload.tieredPricingJSON || payload.tieredPricing);
    if (!tiers) {
      throw new Error(messages.tiered);
    }
    next.tieredTiers = tiers;
  }
  const rawTimePricing = payload.timePricing ?? payload.timePricingJSON;
  if (rawTimePricing === undefined || rawTimePricing === null) {
    next.timePricing = emptyTimePricingFormState();
  } else if (typeof rawTimePricing === "string" || typeof rawTimePricing === "object") {
    const timePricing = parseTimePricingJSON(rawTimePricing);
    if (!isTimePricingFormValid(timePricing)) {
      throw new Error(messages.timePricing);
    }
    next.timePricing = timePricing;
  } else {
    throw new Error(messages.timePricing);
  }
  return next;
}

type PlanBillingDialogProps = {
  open: boolean;
  saving: boolean;
  planForm: PlanFormState | null;
  setPlanForm: React.Dispatch<React.SetStateAction<PlanFormState | null>>;
  permissionGroups: PermissionGroup[];
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onSubmit: (event?: React.FormEvent<HTMLFormElement>) => void;
};

export function PlanBillingDialog({
  open,
  saving,
  planForm,
  setPlanForm,
  permissionGroups,
  onOpenChange,
  onCancel,
  onSubmit,
}: PlanBillingDialogProps) {
  const t = useTranslations("adminBilling");
  const tActions = useTranslations("common.actions");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeightTransition contentClassName="max-h-[min(86vh,760px)]">
          <DialogHeader className="shrink-0 px-4 py-4">
            <DialogTitle>{t("plans.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("plans.dialogDescription")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-2">
              {planForm ? (
                <>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("plans.name")}</p>
                      <Input value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} required />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("plans.price")}</p>
                      <Input value={planForm.amount} type="number" min="0" step="0.01" onChange={(event) => setPlanForm({ ...planForm, amount: event.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("plans.interval")}</p>
                      <Select value={planForm.billingInterval} onValueChange={(value) => setPlanForm({ ...planForm, billingInterval: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lifetime">{t("plans.intervals.lifetime")}</SelectItem>
                          <SelectItem value="month">{t("plans.intervals.month")}</SelectItem>
                          <SelectItem value="year">{t("plans.intervals.year")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("plans.periodCredit")}</p>
                      <Input value={planForm.periodCredit} type="number" min="0" step="0.01" onChange={(event) => setPlanForm({ ...planForm, periodCredit: event.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("plans.description")}</p>
                      <Input value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t("plans.permissionGroup")}</p>
                    <Select
                      value={planForm.permissionGroupID}
                      onValueChange={(value) => setPlanForm({ ...planForm, permissionGroupID: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {permissionGroups.map((group) => (
                          <SelectItem key={group.id} value={String(group.id)}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] leading-5 text-muted-foreground">{t("plans.permissionGroupDescription")}</p>
                  </div>
                </>
              ) : null}
            </div>

            <DialogFooter className="shrink-0 px-4 py-3">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
                {tActions("cancel")}
              </Button>
              <Button type="submit" disabled={saving || !planForm?.name.trim()}>
                {saving ? <SpinnerLabel>{tActions("saving")}</SpinnerLabel> : tActions("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogHeightTransition>
      </DialogContent>
    </Dialog>
  );
}

type PricingBillingDialogProps = {
  open: boolean;
  saving: boolean;
  form: PricingFormState | null;
  durationPricingEnabled: boolean;
  setForm: React.Dispatch<React.SetStateAction<PricingFormState | null>>;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onSubmit: (event?: React.FormEvent<HTMLFormElement>) => void;
  onAddTier: () => void;
  onRemoveTier: (index: number) => void;
  onUpdateTier: (index: number, patch: Partial<TieredPricingTierForm>) => void;
  onOpenOfficialPricing: () => void;
};

export function PricingBillingDialog({
  open,
  saving,
  form,
  durationPricingEnabled,
  setForm,
  onOpenChange,
  onCancel,
  onSubmit,
  onAddTier,
  onRemoveTier,
  onUpdateTier,
  onOpenOfficialPricing,
}: PricingBillingDialogProps) {
  const t = useTranslations("adminBilling");
  const tActions = useTranslations("common.actions");
  const [editorMode, setEditorMode] = React.useState<"form" | "json">("form");
  const [jsonDraft, setJSONDraft] = React.useState("");
  const [jsonError, setJSONError] = React.useState("");

  React.useEffect(() => {
    if (!open || !form) {
      setEditorMode("form");
      setJSONDraft("");
      setJSONError("");
      return;
    }
    const nextJSON = pricingFormToJSON(form);
    if (editorMode !== "json") {
      setJSONDraft(nextJSON);
      setJSONError("");
    }
  }, [editorMode, form, open]);

  const handleJSONChange = React.useCallback((value: string) => {
    setJSONDraft(value);
    if (!form) {
      return;
    }
    try {
      const nextForm = pricingFormFromJSON(form, value, durationPricingEnabled, {
        root: t("modelPricing.jsonErrors.root"),
        model: t("modelPricing.jsonErrors.model"),
        mode: t("modelPricing.jsonErrors.mode"),
        durationVideoOnly: t("modelPricing.jsonErrors.durationVideoOnly"),
        tiered: t("modelPricing.jsonErrors.tiered"),
        timePricing: t("modelPricing.jsonErrors.timePricing"),
      });
      setJSONError("");
      setForm(nextForm);
    } catch (error) {
      setJSONError(error instanceof Error ? error.message : t("modelPricing.jsonErrors.invalid"));
    }
  }, [durationPricingEnabled, form, setForm, t]);

  const handleJSONPricingModeChange = React.useCallback((value: string) => {
    if (!form) {
      return;
    }
    const pricingMode = normalizePricingMode(value);
    if (pricingMode === "duration" && !durationPricingEnabled) {
      return;
    }
    const nextForm = { ...form, pricingMode };
    const nextJSON = pricingFormToJSON(nextForm);
    setForm(nextForm);
    setJSONDraft(nextJSON);
    setJSONError("");
  }, [durationPricingEnabled, form, setForm]);

  const updateTimePricing = React.useCallback((updater: (current: TimePricingFormState) => TimePricingFormState) => {
    setForm((current) => (current ? { ...current, timePricing: updater(current.timePricing) } : current));
  }, [setForm]);

  const addTimePricingPeriod = React.useCallback(() => {
    updateTimePricing((current) => ({ ...current, periods: [...current.periods, createTimePricingPeriodForm()] }));
  }, [updateTimePricing]);

  const removeTimePricingPeriod = React.useCallback((index: number) => {
    updateTimePricing((current) => ({ ...current, periods: current.periods.filter((_, periodIndex) => periodIndex !== index) }));
  }, [updateTimePricing]);

  const updateTimePricingPeriod = React.useCallback((index: number, patch: Partial<TimePricingPeriodForm>) => {
    updateTimePricing((current) => ({
      ...current,
      periods: current.periods.map((period, periodIndex) => (periodIndex === index ? { ...period, ...patch } : period)),
    }));
  }, [updateTimePricing]);

  const toggleTimePricingWeekday = React.useCallback((index: number, weekday: number) => {
    updateTimePricing((current) => ({
      ...current,
      periods: current.periods.map((period, periodIndex) => {
        if (periodIndex !== index) {
          return period;
        }
        const weekdays = period.weekdays.includes(weekday)
          ? period.weekdays.filter((item) => item !== weekday)
          : [...period.weekdays, weekday].sort((left, right) => left - right);
        return { ...period, weekdays };
      }),
    }));
  }, [updateTimePricing]);

  const updateTimePricingWindow = React.useCallback((periodIndex: number, windowIndex: number, patch: Partial<TimePricingWindowForm>) => {
    updateTimePricing((current) => ({
      ...current,
      periods: current.periods.map((period, index) => (
        index === periodIndex
          ? { ...period, windows: period.windows.map((window, innerIndex) => (innerIndex === windowIndex ? { ...window, ...patch } : window)) }
          : period
      )),
    }));
  }, [updateTimePricing]);

  const addTimePricingWindow = React.useCallback((periodIndex: number) => {
    updateTimePricing((current) => ({
      ...current,
      periods: current.periods.map((period, index) => (
        index === periodIndex ? { ...period, windows: [...period.windows, createTimePricingWindowForm()] } : period
      )),
    }));
  }, [updateTimePricing]);

  const removeTimePricingWindow = React.useCallback((periodIndex: number, windowIndex: number) => {
    updateTimePricing((current) => ({
      ...current,
      periods: current.periods.map((period, index) => (
        index === periodIndex ? { ...period, windows: period.windows.filter((_, innerIndex) => innerIndex !== windowIndex) } : period
      )),
    }));
  }, [updateTimePricing]);

  const addTimePricingCampaign = React.useCallback(() => {
    updateTimePricing((current) => ({ ...current, campaigns: [...current.campaigns, createTimePricingCampaignForm()] }));
  }, [updateTimePricing]);

  const removeTimePricingCampaign = React.useCallback((index: number) => {
    updateTimePricing((current) => ({ ...current, campaigns: current.campaigns.filter((_, campaignIndex) => campaignIndex !== index) }));
  }, [updateTimePricing]);

  const updateTimePricingCampaign = React.useCallback((index: number, patch: Partial<TimePricingCampaignForm>) => {
    updateTimePricing((current) => ({
      ...current,
      campaigns: current.campaigns.map((campaign, campaignIndex) => (campaignIndex === index ? { ...campaign, ...patch } : campaign)),
    }));
  }, [updateTimePricing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[620px]">
        <DialogHeightTransition contentClassName="max-h-[min(86vh,760px)]">
          <DialogHeader className="shrink-0 gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>{t("modelPricing.dialogTitle")}</DialogTitle>
              <DialogDescription>{t("modelPricing.dialogDescription")}</DialogDescription>
            </div>
            <Tabs value={editorMode} onValueChange={(value) => setEditorMode(value === "json" ? "json" : "form")} className="shrink-0">
              <TabsList>
                <TabsTrigger value="form">{t("modelPricing.formMode")}</TabsTrigger>
                <TabsTrigger value="json">{t("modelPricing.jsonMode")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </DialogHeader>

          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-2">
              {form ? (
                <>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("modelPricing.platformModel")}</p>
                  <div className="flex items-center gap-2">
                    <Input value={form.platformModelName} className="min-w-0 flex-1 cursor-default text-foreground placeholder:text-muted-foreground" readOnly />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 shrink-0 px-2.5 text-xs shadow-none"
                      disabled={saving}
                      onClick={onOpenOfficialPricing}
                      aria-label={t("modelPricing.officialPricing")}
                      title={t("modelPricing.officialPricing")}
                    >
                      <Sparkles className="size-3.5 stroke-1" />
                      {t("modelPricing.officialPricing")}
                    </Button>
                  </div>
                </div>

                {editorMode === "form" ? (
                  <>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{t("modelPricing.pricingMode")}</p>
                        <Select value={form.pricingMode} onValueChange={(value) => setForm({ ...form, pricingMode: normalizePricingMode(value) })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="token">{t("pricingModes.token")}</SelectItem>
                            <SelectItem value="call">{t("pricingModes.call")}</SelectItem>
                            <SelectItem value="duration" disabled={!durationPricingEnabled}>{t("pricingModes.duration")}</SelectItem>
                            <SelectItem value="tiered">{t("pricingModes.tiered")}</SelectItem>
                          </SelectContent>
                        </Select>
                        {!durationPricingEnabled ? (
                          <p className="text-[11px] text-muted-foreground">{t("modelPricing.durationVideoOnly")}</p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{t("modelPricing.freeModel")}</p>
                        <div className="flex h-8 items-center">
                          <Switch size="sm" checked={form.isFree} onCheckedChange={(checked) => setForm({ ...form, isFree: checked })} />
                        </div>
                      </div>
                    </div>

                    {form.pricingMode === "token" ? (
                      <>
                        <div className="grid grid-cols-2 gap-5">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">{t("modelPricing.inputPerM")}</p>
                            <Input value={form.input} type="number" min="0" step="0.000001" onChange={(event) => setForm({ ...form, input: event.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">{t("modelPricing.outputPerM")}</p>
                            <Input value={form.output} type="number" min="0" step="0.000001" onChange={(event) => setForm({ ...form, output: event.target.value })} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">{t("modelPricing.cacheReadPerM")}</p>
                            <Input value={form.cacheRead} type="number" min="0" step="0.000001" onChange={(event) => setForm({ ...form, cacheRead: event.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">{t("modelPricing.cacheWritePerM")}</p>
                            <Input value={form.cacheWrite} type="number" min="0" step="0.000001" onChange={(event) => setForm({ ...form, cacheWrite: event.target.value })} />
                          </div>
                        </div>
                      </>
                    ) : null}

                    {form.pricingMode === "call" ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{t("modelPricing.perCall")}</p>
                        <Input value={form.call} type="number" min="0" step="0.000001" onChange={(event) => setForm({ ...form, call: event.target.value })} />
                      </div>
                    ) : null}

                    {form.pricingMode === "duration" ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{t("modelPricing.perSecond")}</p>
                        <Input value={form.duration} type="number" min="0" step="0.000001" onChange={(event) => setForm({ ...form, duration: event.target.value })} />
                      </div>
                    ) : null}

                    {form.pricingMode === "tiered" ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">{t("modelPricing.tieredHint")}</p>
                      <Button type="button" variant="ghost" size="xs" onClick={onAddTier}>
                        <Plus className="size-3.5" />
                        {t("modelPricing.addTier")}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {form.tieredTiers.map((tier, index) => (
                        <div key={tier.id} className="grid gap-2 rounded-md border px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium">{t("modelPricing.tierName", { index: index + 1 })}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="text-muted-foreground"
                              disabled={form.tieredTiers.length <= 1}
                              onClick={() => onRemoveTier(index)}
                              aria-label={t("modelPricing.deleteTier")}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            <div className="space-y-1">
                              <p className="text-[11px] text-muted-foreground">{t("modelPricing.tokenLimit")}</p>
                              <Input
                                value={tier.upToTokens}
                                type="number"
                                min="0"
                                step="1"
                                onChange={(event) => onUpdateTier(index, { upToTokens: event.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] text-muted-foreground">{t("modelPricing.inputPerM")}</p>
                              <Input
                                value={tier.input}
                                type="number"
                                min="0"
                                step="0.000001"
                                onChange={(event) => onUpdateTier(index, { input: event.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] text-muted-foreground">{t("modelPricing.outputPerM")}</p>
                              <Input
                                value={tier.output}
                                type="number"
                                min="0"
                                step="0.000001"
                                onChange={(event) => onUpdateTier(index, { output: event.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] text-muted-foreground">{t("modelPricing.cacheReadPerM")}</p>
                              <Input
                                value={tier.cacheRead}
                                type="number"
                                min="0"
                                step="0.000001"
                                onChange={(event) => onUpdateTier(index, { cacheRead: event.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] text-muted-foreground">{t("modelPricing.cacheWritePerM")}</p>
                              <Input
                                value={tier.cacheWrite}
                                type="number"
                                min="0"
                                step="0.000001"
                                onChange={(event) => onUpdateTier(index, { cacheWrite: event.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t("modelPricing.tierNote")}</p>
                  </div>
                    ) : null}

                    {!form.isFree ? (
                      <div className="space-y-3 rounded-md border px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium">{t("modelPricing.timePricingTitle")}</p>
                            <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingHint")}</p>
                          </div>
                          <Button type="button" variant="ghost" size="xs" className="shrink-0" onClick={addTimePricingPeriod}>
                            <Plus className="size-3.5" />
                            {t("modelPricing.timePricingAddPeriod")}
                          </Button>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingTimezone")}</p>
                          <Input
                            value={form.timePricing.timezone}
                            placeholder={DEFAULT_TIME_PRICING_TIMEZONE}
                            className="h-8"
                            onChange={(event) => updateTimePricing((current) => ({ ...current, timezone: event.target.value }))}
                          />
                        </div>

                        {form.timePricing.periods.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingEmpty")}</p>
                        ) : null}

                        {form.timePricing.periods.map((period, periodIndex) => (
                          <div key={period.id} className="space-y-2 rounded-md border px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium">{t("modelPricing.timePricingPeriodName", { index: periodIndex + 1 })}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="text-muted-foreground"
                                onClick={() => removeTimePricingPeriod(periodIndex)}
                                aria-label={t("modelPricing.timePricingDeletePeriod")}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingPeriodLabel")}</p>
                                <Input
                                  value={period.label}
                                  placeholder={t("modelPricing.timePricingPeriodLabelPlaceholder")}
                                  onChange={(event) => updateTimePricingPeriod(periodIndex, { label: event.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingMultiplier")}</p>
                                <Input
                                  value={period.multiplier}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  onChange={(event) => updateTimePricingPeriod(periodIndex, { multiplier: event.target.value })}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingWeekdays")}</p>
                              <div className="flex flex-wrap gap-1">
                                {ALL_TIME_PRICING_WEEKDAYS.map((weekday) => {
                                  const selected = period.weekdays.includes(weekday);
                                  return (
                                    <Button
                                      key={weekday}
                                      type="button"
                                      variant={selected ? "secondary" : "ghost"}
                                      size="xs"
                                      className={selected ? "min-w-8" : "min-w-8 text-muted-foreground"}
                                      aria-pressed={selected}
                                      onClick={() => toggleTimePricingWeekday(periodIndex, weekday)}
                                    >
                                      {t(`modelPricing.timePricingWeekday${weekday}` as "modelPricing.timePricingWeekday0")}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingWindows")}</p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  disabled={period.windows.length >= 12}
                                  onClick={() => addTimePricingWindow(periodIndex)}
                                >
                                  <Plus className="size-3.5" />
                                  {t("modelPricing.timePricingAddWindow")}
                                </Button>
                              </div>
                              {period.windows.map((window, windowIndex) => (
                                <div key={window.id} className="flex items-center gap-2">
                                  <Input
                                    value={window.start}
                                    type="time"
                                    aria-label={t("modelPricing.timePricingWindowStart")}
                                    onChange={(event) => updateTimePricingWindow(periodIndex, windowIndex, { start: event.target.value })}
                                  />
                                  <span className="text-xs text-muted-foreground">–</span>
                                  <Input
                                    value={window.end}
                                    type="time"
                                    aria-label={t("modelPricing.timePricingWindowEnd")}
                                    onChange={(event) => updateTimePricingWindow(periodIndex, windowIndex, { end: event.target.value })}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    className="shrink-0 text-muted-foreground"
                                    onClick={() => removeTimePricingWindow(periodIndex, windowIndex)}
                                    aria-label={t("modelPricing.timePricingDeleteWindow")}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              ))}
                              {period.windows.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingWindowEmpty")}</p>
                              ) : null}
                            </div>
                          </div>
                        ))}

                        <div className="flex items-center justify-between gap-3 border-t pt-3">
                          <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingCampaignHint")}</p>
                          <Button type="button" variant="ghost" size="xs" className="shrink-0" onClick={addTimePricingCampaign}>
                            <Plus className="size-3.5" />
                            {t("modelPricing.timePricingAddCampaign")}
                          </Button>
                        </div>

                        {form.timePricing.campaigns.map((campaign, campaignIndex) => (
                          <div key={campaign.id} className="space-y-2 rounded-md border px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium">{t("modelPricing.timePricingCampaignName", { index: campaignIndex + 1 })}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="text-muted-foreground"
                                onClick={() => removeTimePricingCampaign(campaignIndex)}
                                aria-label={t("modelPricing.timePricingDeleteCampaign")}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingPeriodLabel")}</p>
                                <Input
                                  value={campaign.label}
                                  placeholder={t("modelPricing.timePricingPeriodLabelPlaceholder")}
                                  onChange={(event) => updateTimePricingCampaign(campaignIndex, { label: event.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingMultiplier")}</p>
                                <Input
                                  value={campaign.multiplier}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  onChange={(event) => updateTimePricingCampaign(campaignIndex, { multiplier: event.target.value })}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingCampaignMonth")}</p>
                                <Input
                                  value={campaign.month}
                                  type="number"
                                  min="0"
                                  max="12"
                                  step="1"
                                  placeholder="0"
                                  onChange={(event) => updateTimePricingCampaign(campaignIndex, { month: event.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingCampaignFromDay")}</p>
                                <Input
                                  value={campaign.fromDay}
                                  type="number"
                                  min="0"
                                  max="31"
                                  step="1"
                                  placeholder="1"
                                  onChange={(event) => updateTimePricingCampaign(campaignIndex, { fromDay: event.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingCampaignBeforeDay")}</p>
                                <Input
                                  value={campaign.beforeDay}
                                  type="number"
                                  min="0"
                                  max="31"
                                  step="1"
                                  placeholder="31"
                                  onChange={(event) => updateTimePricingCampaign(campaignIndex, { beforeDay: event.target.value })}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingCampaignStartDate")}</p>
                                <Input
                                  value={campaign.startDate}
                                  type="date"
                                  onChange={(event) => updateTimePricingCampaign(campaignIndex, { startDate: event.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">{t("modelPricing.timePricingCampaignEndDate")}</p>
                                <Input
                                  value={campaign.endDate}
                                  type="date"
                                  onChange={(event) => updateTimePricingCampaign(campaignIndex, { endDate: event.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                        ))}

                        <p className={isTimePricingFormValid(form.timePricing) ? "text-[11px] text-muted-foreground" : "text-[11px] text-destructive"}>
                          {isTimePricingFormValid(form.timePricing) ? t("modelPricing.timePricingNote") : t("modelPricing.timePricingInvalid")}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t("modelPricing.pricingMode")}</p>
                      <Select value={form.pricingMode} onValueChange={handleJSONPricingModeChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="token">{t("pricingModes.token")}</SelectItem>
                          <SelectItem value="call">{t("pricingModes.call")}</SelectItem>
                          <SelectItem value="duration" disabled={!durationPricingEnabled}>{t("pricingModes.duration")}</SelectItem>
                          <SelectItem value="tiered">{t("pricingModes.tiered")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      value={jsonDraft}
                      className="h-80 resize-none overflow-y-auto font-mono text-xs [field-sizing:fixed]"
                      spellCheck={false}
                      disabled={saving}
                      onChange={(event) => handleJSONChange(event.target.value)}
                    />
                    <p className={jsonError ? "text-[11px] text-destructive" : "text-[11px] text-muted-foreground"}>
                      {jsonError || t("modelPricing.jsonHint")}
                    </p>
                  </div>
                )}
                </>
              ) : null}
            </div>

            <DialogFooter className="shrink-0 px-4 py-3">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
                {tActions("cancel")}
              </Button>
              <Button type="submit" disabled={saving || Boolean(jsonError)}>
                {saving ? <SpinnerLabel>{tActions("saving")}</SpinnerLabel> : tActions("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogHeightTransition>
      </DialogContent>
    </Dialog>
  );
}
