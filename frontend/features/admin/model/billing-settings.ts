import type {
  AdminBillingPlanDTO,
  AdminModelPricingDTO,
  UpsertAdminModelPricingRequest,
} from "@/features/admin/api/billing.types";
import type { AdminLLMModelDTO } from "@/features/admin/api/llm.types";
import type { PatchSettingItem, SettingItem } from "@/shared/api/settings.types";
import { parseKindsJSON } from "@/shared/model/llm-schema";

export type BillingModelPricingRow = {
  platformModelName: string;
  vendor: string;
  icon: string;
  pricing: AdminModelPricingDTO | null;
  isFree: boolean;
  supportsVideoGeneration: boolean;
};

export type PricingMode = "token" | "call" | "duration" | "tiered";

export type TieredPricingTierForm = {
  id: string;
  upToTokens: string;
  input: string;
  cacheRead: string;
  cacheWrite: string;
  output: string;
};

export type TimePricingWindowForm = {
  id: string;
  start: string;
  end: string;
};

export type TimePricingPeriodForm = {
  id: string;
  label: string;
  multiplier: string;
  weekdays: number[];
  windows: TimePricingWindowForm[];
};

export type TimePricingCampaignForm = {
  id: string;
  label: string;
  multiplier: string;
  month: string;
  fromDay: string;
  beforeDay: string;
  startDate: string;
  endDate: string;
};

export type TimePricingFormState = {
  timezone: string;
  periods: TimePricingPeriodForm[];
  campaigns: TimePricingCampaignForm[];
};

export type PricingFormState = {
  platformModelName: string;
  pricingMode: PricingMode;
  input: string;
  cacheRead: string;
  cacheWrite: string;
  cacheWritePriceBasis: UpsertAdminModelPricingRequest["cacheWritePriceBasis"];
  output: string;
  call: string;
  duration: string;
  tieredTiers: TieredPricingTierForm[];
  timePricing: TimePricingFormState;
  isFree: boolean;
};

export type PlanFormState = {
  name: string;
  description: string;
  amount: string;
  billingInterval: string;
  periodCredit: string;
  permissionGroupID: string;
};

export type ModelPricingExportEntry = {
  currency: string;
  isFree: boolean;
  pricingMode: PricingMode;
  inputUSDPerMTokens: number;
  cacheReadUSDPerMTokens: number;
  cacheWriteUSDPerMTokens: number;
  cacheWritePriceBasis?: UpsertAdminModelPricingRequest["cacheWritePriceBasis"];
  outputUSDPerMTokens: number;
  callUSDPerCall: number;
  durationUSDPerSecond: number;
  tieredPricing?: unknown;
  timePricing?: unknown;
};

export type ModelPricingImportParseResult = {
  items: UpsertAdminModelPricingRequest[];
  errors: string[];
  unknownModelNames: string[];
};

export type ModelPricingImportMessages = {
  invalidJSON: string;
  rootObject: string;
  emptyModelName: string;
  duplicateModel: (model: string) => string;
  pricingObject: (model: string) => string;
  invalidPricingMode: (model: string) => string;
  durationVideoOnly: (model: string) => string;
  invalidNumber: (model: string, field: string) => string;
  invalidTieredPricing: (model: string, field: string) => string;
  invalidTieredPricingJSON: (model: string) => string;
  invalidTimePricing: (model: string, field: string) => string;
};

export const DEFAULT_PAGE_SIZE = 25;
export const PAYMENT_SETTING_KEYS = [
  "payment_providers",
  "stripe_publishable_key",
  "stripe_secret_key",
  "stripe_webhook_secret",
  "epay_gateway_url",
  "epay_types",
  "epay_pid",
  "epay_key",
] as const;
export type PaymentProvider = "stripe" | "epay";
export type PaymentSettings = Record<(typeof PAYMENT_SETTING_KEYS)[number], string>;

export const PAYMENT_DEFAULTS: PaymentSettings = {
  payment_providers: "disabled",
  stripe_publishable_key: "",
  stripe_secret_key: "",
  stripe_webhook_secret: "",
  epay_gateway_url: "",
  epay_types: `[
  {"name":"Alipay","type":"alipay"},
  {"name":"WeChat Pay","type":"wxpay"}
]`,
  epay_pid: "",
  epay_key: "",
};

const DEFAULT_TIERED_TIERS: TieredPricingTierForm[] = [
  {
    id: "default-1",
    upToTokens: "200000",
    input: "0",
    cacheRead: "0",
    cacheWrite: "0",
    output: "0",
  },
  {
    id: "default-2",
    upToTokens: "0",
    input: "0",
    cacheRead: "0",
    cacheWrite: "0",
    output: "0",
  },
];

export function formatBillingAmountInput(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN) || (value ?? 0) <= 0) {
    return "0";
  }
  return String(value);
}

export function downloadJSONFile(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function shortListDescription(items: string[], emptyText = "", moreLabel = "and"): string {
  if (items.length === 0) {
    return emptyText;
  }
  const visible = items.slice(0, 5).join(", ");
  return items.length > 5 ? `${visible} ${moreLabel} ${items.length}` : visible;
}

// 站点金额（模型单价、余额、赠送额度）一律按展示币种记录，管理端金额前缀必须跟随
// display_currency。上游写死 "$" 会让人民币站点把人民币金额显示成美元。
let adminBillingCurrencySymbol = "$";

export function setAdminBillingCurrencySymbol(symbol: string | null | undefined): void {
  const normalized = typeof symbol === "string" ? symbol.trim() : "";
  adminBillingCurrencySymbol = normalized || "$";
}

export function getAdminBillingCurrencySymbol(): string {
  return adminBillingCurrencySymbol;
}

export function resolveAdminBillingCurrencySymbol(
  displayCurrency?: string | null,
  usdToCnyRate?: number | null,
): string {
  if (displayCurrency !== "CNY") {
    return "$";
  }
  const rate = Number(usdToCnyRate);
  return Number.isFinite(rate) && rate > 0 ? "¥" : "$";
}

export function formatUSD(value: number): string {
  // 固定三位小数让管理端价格列对齐；币种前缀仍跟随 display_currency。
  const amount = Number.isFinite(value) && value > 0 ? value : 0;
  return `${adminBillingCurrencySymbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

export function formatAmountCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format((cents || 0) / 100);
}

export function formatCreditUSD(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return `${adminBillingCurrencySymbol}0`;
  return `${adminBillingCurrencySymbol}${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(value: string, locale = "en-US"): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function cloneDefaultTieredTiers(): TieredPricingTierForm[] {
  return DEFAULT_TIERED_TIERS.map((tier) => ({ ...tier }));
}

export function parseTieredPricingJSON(raw: unknown): TieredPricingTierForm[] | null {
  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || !("tiers" in parsed) || !Array.isArray(parsed.tiers) || parsed.tiers.length === 0) {
      return null;
    }
    return parsed.tiers.map((rawTier, index) => {
      const tier = rawTier && typeof rawTier === "object" && !Array.isArray(rawTier) ? rawTier as Record<string, unknown> : {};
      const price = (key: string) => String(parsePrice(String(tier[key] ?? "0")));
      const upToTokens = String(Math.trunc(parsePrice(String(tier.upToTokens ?? "0"))));
      return {
        id: `saved-${index}-${upToTokens}`,
        upToTokens,
        input: price("inputUSDPerMTokens"),
        cacheRead: price("cacheReadUSDPerMTokens"),
        cacheWrite: price("cacheWriteUSDPerMTokens"),
        output: price("outputUSDPerMTokens"),
      };
    });
  } catch {
    return null;
  }
}

export function stringifyTieredPricing(tiers: TieredPricingTierForm[]): string {
  return JSON.stringify({
    tiers: tiers.map((tier) => ({
      upToTokens: parseIntValue(tier.upToTokens),
      inputUSDPerMTokens: parsePrice(tier.input),
      cacheReadUSDPerMTokens: parsePrice(tier.cacheRead),
      cacheWriteUSDPerMTokens: parsePrice(tier.cacheWrite),
      outputUSDPerMTokens: parsePrice(tier.output),
    })),
  });
}

export const DEFAULT_TIME_PRICING_TIMEZONE = "Asia/Shanghai";
export const ALL_TIME_PRICING_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

let timePricingFormIDSeed = 0;

function nextTimePricingFormID(prefix: string): string {
  timePricingFormIDSeed += 1;
  return `${prefix}-${Date.now().toString(36)}-${timePricingFormIDSeed}`;
}

export function createTimePricingWindowForm(start = "09:00", end = "12:00"): TimePricingWindowForm {
  return { id: nextTimePricingFormID("window"), start, end };
}

export function createTimePricingPeriodForm(): TimePricingPeriodForm {
  return {
    id: nextTimePricingFormID("period"),
    label: "",
    multiplier: "1",
    weekdays: [1, 2, 3, 4, 5],
    windows: [createTimePricingWindowForm("09:00", "12:00")],
  };
}

export function createTimePricingCampaignForm(): TimePricingCampaignForm {
  return {
    id: nextTimePricingFormID("campaign"),
    label: "",
    multiplier: "1",
    month: "",
    fromDay: "",
    beforeDay: "",
    startDate: "",
    endDate: "",
  };
}

export function emptyTimePricingFormState(): TimePricingFormState {
  return { timezone: "", periods: [], campaigns: [] };
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function timePricingNumberText(value: unknown, fallback = ""): string {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? String(parsed) : fallback;
}

function parseTimePricingWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const weekdays: number[] = [];
  for (const item of value) {
    const parsed = typeof item === "number" ? item : Number(item);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 6 && !weekdays.includes(parsed)) {
      weekdays.push(parsed);
    }
  }
  return weekdays.sort((left, right) => left - right);
}

// parseTimePricingJSON 解析后端返回的时段计费配置；配置非法或为空时回退到“全天同价”，避免因脏数据打不开编辑弹窗。
export function parseTimePricingJSON(raw: unknown): TimePricingFormState {
  const parsed: unknown = typeof raw === "string" ? safeJSONParse(raw) : raw;
  if (!isRecordValue(parsed)) {
    return emptyTimePricingFormState();
  }
  const timezone = typeof parsed.timezone === "string" ? parsed.timezone.trim() : "";
  const periods: TimePricingPeriodForm[] = Array.isArray(parsed.periods)
    ? parsed.periods.filter(isRecordValue).map((period) => ({
        id: nextTimePricingFormID("period"),
        label: typeof period.label === "string" ? period.label.trim() : "",
        multiplier: timePricingNumberText(period.multiplier, "1"),
        weekdays: parseTimePricingWeekdays(period.weekdays),
        windows: Array.isArray(period.windows)
          ? period.windows
              .filter((window) => Array.isArray(window) && window.length >= 2)
              .map((window) => {
                const [start, end] = window as unknown[];
                return {
                  id: nextTimePricingFormID("window"),
                  start: typeof start === "string" ? start.trim() : "",
                  end: typeof end === "string" ? end.trim() : "",
                };
              })
          : [],
      }))
    : [];
  const campaigns: TimePricingCampaignForm[] = Array.isArray(parsed.campaigns)
    ? parsed.campaigns.filter(isRecordValue).map((campaign) => ({
        id: nextTimePricingFormID("campaign"),
        label: typeof campaign.label === "string" ? campaign.label.trim() : "",
        multiplier: timePricingNumberText(campaign.multiplier, "1"),
        month: timePricingNumberText(campaign.month),
        fromDay: timePricingNumberText(campaign.fromDay),
        beforeDay: timePricingNumberText(campaign.beforeDay),
        startDate: timePricingDateText(campaign.startDate),
        endDate: timePricingDateText(campaign.endDate),
      }))
    : [];
  return { timezone, periods, campaigns };
}

function timePricingDateText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function safeJSONParse(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function timePricingInteger(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function timePricingMultiplier(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

// stringifyTimePricing 把编辑态序列化为后端约定的 JSON；没有任何时段与活动时统一落为空对象。
export function stringifyTimePricing(form: TimePricingFormState): string {
  if (form.periods.length === 0 && form.campaigns.length === 0) {
    return "{}";
  }
  const timezone = form.timezone.trim();
  const periods = form.periods.map((period) => ({
    label: period.label.trim(),
    multiplier: timePricingMultiplier(period.multiplier),
    weekdays: [...period.weekdays].sort((left, right) => left - right),
    windows: period.windows.map((window) => [window.start.trim(), window.end.trim()]),
  }));
  const campaigns = form.campaigns.map((campaign) => ({
    label: campaign.label.trim(),
    multiplier: timePricingMultiplier(campaign.multiplier),
    month: timePricingInteger(campaign.month),
    fromDay: timePricingInteger(campaign.fromDay),
    beforeDay: timePricingInteger(campaign.beforeDay),
    startDate: campaign.startDate.trim(),
    endDate: campaign.endDate.trim(),
  }));
  return JSON.stringify({
    ...(timezone ? { timezone } : {}),
    periods,
    campaigns,
  });
}

export function timePricingClockMinutes(value: string): number | null {
  const matched = /^(\d{1,2}):(\d{2})$/u.exec(value.trim());
  if (!matched) {
    return null;
  }
  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (hour > 24 || minute > 59 || (hour === 24 && minute !== 0)) {
    return null;
  }
  return hour * 60 + minute;
}

export function isTimePricingFormValid(form: TimePricingFormState): boolean {
  if (form.periods.length === 0 && form.campaigns.length === 0) {
    return true;
  }
  if (form.periods.length > 20 || form.campaigns.length > 20) {
    return false;
  }
  const timezone = form.timezone.trim();
  if (timezone && !/^[A-Za-z0-9_+\-/]{1,64}$/u.test(timezone)) {
    return false;
  }
  for (const period of form.periods) {
    if (timePricingMultiplier(period.multiplier) <= 0 || timePricingMultiplier(period.multiplier) > 1000) {
      return false;
    }
    if (period.windows.length > 12) {
      return false;
    }
    for (const weekday of period.weekdays) {
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        return false;
      }
    }
    for (const window of period.windows) {
      const start = timePricingClockMinutes(window.start);
      const end = timePricingClockMinutes(window.end);
      if (start === null || end === null || end <= start) {
        return false;
      }
    }
  }
  for (const campaign of form.campaigns) {
    if (timePricingMultiplier(campaign.multiplier) <= 0 || timePricingMultiplier(campaign.multiplier) > 1000) {
      return false;
    }
    const month = timePricingInteger(campaign.month);
    const fromDay = timePricingInteger(campaign.fromDay);
    const beforeDay = timePricingInteger(campaign.beforeDay);
    if (month > 12 || fromDay > 31 || beforeDay > 31) {
      return false;
    }
    if (fromDay > 0 && beforeDay > 0 && fromDay >= beforeDay) {
      return false;
    }
    const startDate = campaign.startDate.trim();
    const endDate = campaign.endDate.trim();
    // ISO 日期字符串可直接按字典序比较；与后端一致，EndDate 含当天。
    if (startDate && !isTimePricingDateText(startDate)) {
      return false;
    }
    if (endDate && !isTimePricingDateText(endDate)) {
      return false;
    }
    if (startDate && endDate && startDate >= endDate) {
      return false;
    }
  }
  return true;
}

// isTimePricingDateText 校验 YYYY-MM-DD，并确认是可真实存在的日历日期（排除 2026-02-30）。
function isTimePricingDateText(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function createFormState(row: BillingModelPricingRow): PricingFormState {
  const pricing = row.pricing;
  return {
    platformModelName: row.platformModelName,
    pricingMode: normalizePricingMode(pricing?.pricingMode),
    input: String(pricing?.inputUSDPerMTokens ?? 0),
    cacheRead: String(pricing?.cacheReadUSDPerMTokens ?? 0),
    cacheWrite: String(pricing?.cacheWriteUSDPerMTokens ?? 0),
    cacheWritePriceBasis: pricing?.cacheWritePriceBasis,
    output: String(pricing?.outputUSDPerMTokens ?? 0),
    call: String(pricing?.callUSDPerCall ?? 0),
    duration: String(pricing?.durationUSDPerSecond ?? 0),
    tieredTiers: parseTieredPricingJSON(pricing?.tieredPricingJSON) ?? cloneDefaultTieredTiers(),
    timePricing: parseTimePricingJSON(pricing?.timePricingJSON),
    isFree: pricing?.isFree ?? row.isFree,
  };
}

export function createPlanFormState(plan: AdminBillingPlanDTO, defaultPermissionGroupID?: number): PlanFormState {
  const defaultPrice = plan.prices.find((item) => item.isDefault) || plan.prices[0];
  let permissionGroupID = "";
  if (plan.permissionGroupID != null) {
    permissionGroupID = String(plan.permissionGroupID);
  } else if (defaultPermissionGroupID) {
    permissionGroupID = String(defaultPermissionGroupID);
  }
  return {
    name: plan.name || "",
    description: plan.description || "",
    amount: String((defaultPrice?.amountCents ?? 0) / 100),
    billingInterval: defaultPrice?.billingInterval || "month",
    periodCredit: String(plan.periodCreditUSD ?? 0),
    permissionGroupID,
  };
}

export function parsePrice(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export function normalizePricingMode(value: string | null | undefined): PricingMode {
  if (value === "call" || value === "duration" || value === "tiered") return value;
  return "token";
}

function isPricingMode(value: unknown): value is PricingMode {
  return value === "token" || value === "call" || value === "duration" || value === "tiered";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const DEFAULT_IMPORT_MESSAGES: ModelPricingImportMessages = {
  invalidJSON: "File content is not valid JSON",
  rootObject: "Model pricing JSON must be an object keyed by platform model name",
  emptyModelName: "Platform model name cannot be empty",
  duplicateModel: (model) => `${model} appears more than once`,
  pricingObject: (model) => `${model} pricing must be an object`,
  invalidPricingMode: (model) => `${model}.pricingMode must be token, call, duration, or tiered`,
  durationVideoOnly: (model) => `${model}.pricingMode=duration requires a video model capability`,
  invalidNumber: (model, field) => `${model}.${field} must be a number greater than or equal to 0`,
  invalidTieredPricing: (model, field) => `${model}.${field} must contain a non-empty tiers array`,
  invalidTieredPricingJSON: (model) => `${model}.tieredPricingJSON is not valid JSON`,
  invalidTimePricing: (model, field) => `${model}.${field} must contain valid time pricing periods or campaigns`,
};

function numberFromPricingField(
  entry: Record<string, unknown>,
  key: string,
  errors: string[],
  platformModelName: string,
  messages: ModelPricingImportMessages,
): number {
  const value = entry[key];
  if (value === undefined || value === null || value === "") {
    return 0;
  }
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    errors.push(messages.invalidNumber(platformModelName, key));
    return 0;
  }
  return parsed;
}

function parseTieredPricingImportValue(
  entry: Record<string, unknown>,
  platformModelName: string,
  errors: string[],
  messages: ModelPricingImportMessages,
): string {
  const rawJSON = entry.tieredPricingJSON;
  if (typeof rawJSON === "string" && rawJSON.trim()) {
    try {
      const parsed = JSON.parse(rawJSON) as unknown;
      if (!isValidTieredPricingConfig(parsed)) {
        errors.push(messages.invalidTieredPricing(platformModelName, "tieredPricingJSON"));
        return "";
      }
      return JSON.stringify(parsed);
    } catch {
      errors.push(messages.invalidTieredPricingJSON(platformModelName));
      return "";
    }
  }

  const raw = entry.tieredPricing;
  if (!isValidTieredPricingConfig(raw)) {
    errors.push(messages.invalidTieredPricing(platformModelName, "tieredPricing"));
    return "";
  }
  return JSON.stringify(raw);
}

function isValidTieredPricingConfig(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.tiers) || value.tiers.length === 0) {
    return false;
  }
  return value.tiers.every((tier) => {
    if (!isRecord(tier)) {
      return false;
    }
    const upToTokens = tier.upToTokens;
    return upToTokens === undefined || (typeof upToTokens === "number" && Number.isFinite(upToTokens) && upToTokens >= 0);
  });
}

function parseTieredPricingExportValue(raw: string): unknown {
  try {
    const parsed = JSON.parse(raw || "{}") as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseTimePricingImportValue(
  entry: Record<string, unknown>,
  platformModelName: string,
  errors: string[],
  messages: ModelPricingImportMessages,
): string | undefined {
  const raw = entry.timePricingJSON ?? entry.timePricing;
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const parsed = typeof raw === "string" ? safeJSONParse(raw) : raw;
  if (!isRecordValue(parsed)) {
    errors.push(messages.invalidTimePricing(platformModelName, "timePricing"));
    return undefined;
  }
  const form = parseTimePricingJSON(parsed);
  if (!isTimePricingFormValid(form)) {
    errors.push(messages.invalidTimePricing(platformModelName, "timePricing"));
    return undefined;
  }
  // 统一走一遍解析与序列化，剔除后端会拒绝的未知字段。
  return stringifyTimePricing(form);
}

function timePricingExportValue(raw: string): unknown | null {
  const form = parseTimePricingJSON(raw);
  if (form.periods.length === 0 && form.campaigns.length === 0) {
    return null;
  }
  return safeJSONParse(stringifyTimePricing(form));
}

export function buildModelPricingExportObject(pricingItems: AdminModelPricingDTO[]): Record<string, ModelPricingExportEntry> {
  const result: Record<string, ModelPricingExportEntry> = {};
  const sorted = [...pricingItems].sort((left, right) => left.platformModelName.localeCompare(right.platformModelName));
  for (const item of sorted) {
    const platformModelName = item.platformModelName.trim();
    if (!platformModelName) {
      continue;
    }
    const pricingMode = normalizePricingMode(item.pricingMode);
    const timePricing = timePricingExportValue(item.timePricingJSON);
    result[platformModelName] = {
      currency: item.currency || "USD",
      isFree: item.isFree,
      pricingMode,
      inputUSDPerMTokens: pricingMode === "token" ? item.inputUSDPerMTokens : 0,
      cacheReadUSDPerMTokens: pricingMode === "token" ? item.cacheReadUSDPerMTokens : 0,
      cacheWriteUSDPerMTokens: pricingMode === "token" ? item.cacheWriteUSDPerMTokens : 0,
      cacheWritePriceBasis: item.cacheWritePriceBasis,
      outputUSDPerMTokens: pricingMode === "token" ? item.outputUSDPerMTokens : 0,
      callUSDPerCall: pricingMode === "call" ? item.callUSDPerCall : 0,
      durationUSDPerSecond: pricingMode === "duration" ? item.durationUSDPerSecond : 0,
      ...(pricingMode === "tiered" ? { tieredPricing: parseTieredPricingExportValue(item.tieredPricingJSON) } : {}),
      ...(timePricing ? { timePricing } : {}),
    };
  }
  return result;
}

function modelPricingNanousd(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value * 1_000_000_000);
}

export function mergeModelPricingItem(items: AdminModelPricingDTO[], item: AdminModelPricingDTO): AdminModelPricingDTO[] {
  const index = items.findIndex((current) => current.platformModelName === item.platformModelName);
  if (index < 0) {
    return [...items, item];
  }
  const next = [...items];
  next[index] = item;
  return next;
}

export function createOptimisticModelPricing(row: BillingModelPricingRow, payload: UpsertAdminModelPricingRequest): AdminModelPricingDTO {
  const pricingMode = normalizePricingMode(payload.pricingMode);
  const now = new Date().toISOString();
  const inputUSDPerMTokens = pricingMode === "token" ? payload.inputUSDPerMTokens : 0;
  const cacheReadUSDPerMTokens = pricingMode === "token" ? payload.cacheReadUSDPerMTokens : 0;
  const cacheWriteUSDPerMTokens = pricingMode === "token" ? payload.cacheWriteUSDPerMTokens : 0;
  const outputUSDPerMTokens = pricingMode === "token" ? payload.outputUSDPerMTokens : 0;
  const callUSDPerCall = pricingMode === "call" ? payload.callUSDPerCall : 0;
  const durationUSDPerSecond = pricingMode === "duration" ? payload.durationUSDPerSecond : 0;
  return {
    id: row.pricing?.id ?? 0,
    platformModelName: payload.platformModelName,
    modelVendor: row.pricing?.modelVendor || row.vendor,
    modelIcon: row.pricing?.modelIcon || row.icon,
    currency: payload.currency || row.pricing?.currency || "USD",
    isFree: payload.isFree,
    pricingMode,
    inputUSDPerMTokens,
    cacheReadUSDPerMTokens,
    cacheWriteUSDPerMTokens,
    cacheWritePriceBasis: payload.cacheWritePriceBasis,
    outputUSDPerMTokens,
    callUSDPerCall,
    durationUSDPerSecond,
    tieredPricingJSON: pricingMode === "tiered" ? payload.tieredPricingJSON || "" : "",
    timePricingJSON: payload.timePricingJSON || "",
    inputNanousdPerMTokens: modelPricingNanousd(inputUSDPerMTokens),
    cacheReadNanousdPerMTokens: modelPricingNanousd(cacheReadUSDPerMTokens),
    cacheWriteNanousdPerMTokens: modelPricingNanousd(cacheWriteUSDPerMTokens),
    outputNanousdPerMTokens: modelPricingNanousd(outputUSDPerMTokens),
    callNanousdPerCall: modelPricingNanousd(callUSDPerCall),
    durationNanousdPerSecond: modelPricingNanousd(durationUSDPerSecond),
    createdAt: row.pricing?.createdAt || now,
    updatedAt: now,
  };
}

export function parseModelPricingImportJSON(
  raw: string,
  knownPlatformModelNames: Set<string>,
  videoGenerationModelNames: Set<string>,
  messages: ModelPricingImportMessages = DEFAULT_IMPORT_MESSAGES,
): ModelPricingImportParseResult {
  const errors: string[] = [];
  const unknownModelNames: string[] = [];
  const items: UpsertAdminModelPricingRequest[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      items: [],
      errors: [messages.invalidJSON],
      unknownModelNames: [],
    };
  }

  if (!isRecord(parsed)) {
    return {
      items: [],
      errors: [messages.rootObject],
      unknownModelNames: [],
    };
  }

  const seen = new Set<string>();
  for (const [rawName, rawEntry] of Object.entries(parsed)) {
    const platformModelName = rawName.trim();
    if (!platformModelName) {
      errors.push(messages.emptyModelName);
      continue;
    }
    if (seen.has(platformModelName)) {
      errors.push(messages.duplicateModel(platformModelName));
      continue;
    }
    seen.add(platformModelName);

    if (!knownPlatformModelNames.has(platformModelName)) {
      unknownModelNames.push(platformModelName);
      continue;
    }
    if (!isRecord(rawEntry)) {
      errors.push(messages.pricingObject(platformModelName));
      continue;
    }
    if (!isPricingMode(rawEntry.pricingMode)) {
      errors.push(messages.invalidPricingMode(platformModelName));
      continue;
    }
    const entryErrors: string[] = [];
    if (rawEntry.cacheWritePriceBasis !== undefined && rawEntry.cacheWritePriceBasis !== "direct" && rawEntry.cacheWritePriceBasis !== "anthropic_5m") {
      errors.push(messages.pricingObject(platformModelName));
      continue;
    }
    const pricingMode = rawEntry.pricingMode;
    if (pricingMode === "duration" && !videoGenerationModelNames.has(platformModelName)) {
      errors.push(messages.durationVideoOnly(platformModelName));
      continue;
    }
    const tieredPricingJSON = pricingMode === "tiered"
      ? parseTieredPricingImportValue(rawEntry, platformModelName, entryErrors, messages)
      : undefined;
    const timePricingJSON = parseTimePricingImportValue(rawEntry, platformModelName, entryErrors, messages);
    const request: UpsertAdminModelPricingRequest = {
      platformModelName,
      currency: typeof rawEntry.currency === "string" && rawEntry.currency.trim() ? rawEntry.currency.trim() : "USD",
      isFree: typeof rawEntry.isFree === "boolean" ? rawEntry.isFree : false,
      cacheWritePriceBasis: rawEntry.cacheWritePriceBasis,
      pricingMode,
      inputUSDPerMTokens: pricingMode === "token" ? numberFromPricingField(rawEntry, "inputUSDPerMTokens", entryErrors, platformModelName, messages) : 0,
      cacheReadUSDPerMTokens: pricingMode === "token" ? numberFromPricingField(rawEntry, "cacheReadUSDPerMTokens", entryErrors, platformModelName, messages) : 0,
      cacheWriteUSDPerMTokens: pricingMode === "token" ? numberFromPricingField(rawEntry, "cacheWriteUSDPerMTokens", entryErrors, platformModelName, messages) : 0,
      outputUSDPerMTokens: pricingMode === "token" ? numberFromPricingField(rawEntry, "outputUSDPerMTokens", entryErrors, platformModelName, messages) : 0,
      callUSDPerCall: pricingMode === "call" ? numberFromPricingField(rawEntry, "callUSDPerCall", entryErrors, platformModelName, messages) : 0,
      durationUSDPerSecond: pricingMode === "duration" ? numberFromPricingField(rawEntry, "durationUSDPerSecond", entryErrors, platformModelName, messages) : 0,
      tieredPricingJSON,
      ...(timePricingJSON !== undefined ? { timePricingJSON } : {}),
    };
    if (entryErrors.length > 0) {
      errors.push(...entryErrors);
      continue;
    }
    items.push(request);
  }

  return { items, errors, unknownModelNames };
}

export function buildPricingRows(models: AdminLLMModelDTO[], pricingItems: AdminModelPricingDTO[]): BillingModelPricingRow[] {
  const pricingMap = new Map(pricingItems.map((item) => [item.platformModelName, item]));
  const groupedModels = new Map<string, AdminLLMModelDTO>();

  for (const model of models) {
    if (model.status !== "active") continue;
    if (model.activeSourceCount <= 0) continue;
    const platformModelName = model.platformModelName.trim();
    if (!platformModelName) continue;
    if (!groupedModels.has(platformModelName)) {
      groupedModels.set(platformModelName, model);
    }
  }

  return Array.from(groupedModels.entries())
    .map(([platformModelName, model]) => {
      const pricing = pricingMap.get(platformModelName) || null;
      return {
        platformModelName,
        vendor: pricing?.modelVendor || model.vendor || "",
        icon: pricing?.modelIcon || model.icon || "",
        pricing,
        isFree: pricing?.isFree ?? false,
        supportsVideoGeneration: parseKindsJSON(model.kindsJSON).some(
          (kind) => kind === "video_gen" || kind === "video_extension",
        ),
      };
    });
}

export function parseIntValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export function flattenPaymentSettings(items: SettingItem[]): PaymentSettings {
  const next = { ...PAYMENT_DEFAULTS };
  for (const item of items) {
    if ((PAYMENT_SETTING_KEYS as readonly string[]).includes(item.key)) {
      next[item.key as keyof PaymentSettings] = item.value;
    }
  }
  return next;
}

export function paymentSettingsChanged(current: PaymentSettings, saved: PaymentSettings): boolean {
  return PAYMENT_SETTING_KEYS.some((key) => current[key] !== saved[key]);
}

export function normalizePaymentProviders(value: string): PaymentProvider[] {
  const providers: PaymentProvider[] = [];
  for (const part of value.split(",")) {
    const provider = part.trim();
    if ((provider === "stripe" || provider === "epay") && !providers.includes(provider)) {
      providers.push(provider);
    }
  }
  return providers;
}

export function paymentProviderSetting(providers: PaymentProvider[]): string {
  return providers.length > 0 ? providers.join(",") : "disabled";
}

export function parseEPayTypesJSON(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as Array<{ name?: unknown; type?: unknown }>;
    return (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((item) => typeof item.name === "string" && item.name.trim() && typeof item.type === "string" && item.type.trim())
    );
  } catch {
    return false;
  }
}

export function paymentPatchItems(settings: PaymentSettings): PatchSettingItem[] {
  return PAYMENT_SETTING_KEYS.map((key) => ({
    namespace: "billing",
    key,
    value: settings[key].trim(),
  }));
}
