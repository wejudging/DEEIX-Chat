# HOHAI Customizations

This file records HOHAI-specific behavior that must be preserved when merging updates from `upstream/dev`.

Current customization branch: `hohai/custom-branding-billing-v7`.
The behavior below was revalidated against upstream commit `bb4e8fe0` on 2026-09-13, and again
against upstream commit `135007e7` (the `upstream/dev` tip merged into `769055ce`) on 2026-09-15.
The 2026-09-15 sync also adopted the upstream message-delete feature (PR #704) and the nested
code-block rendering fix (PR #735) without touching any HOHAI customization.
The 2026-09-16 sync merged upstream commit `d8d94ab7` (16 upstream commits, PR #749–#756) into
`c158b225`: OpenRouter image generation, richer markdown paste, account-lockout error reporting,
tool-trace retention during long reasoning streams, markdown table line-height fixes, stable model
submenu placement, leading system-message merging for OpenAI-compatible upstreams, and the dark
theme contrast recalibration that also keeps the color mode per device. The only HOHAI-adjacent
files upstream touched are `app-chat-area` neighbours, `chat-model-picker.tsx`,
`message-submit-exchange.ts`, the error catalogs, `auth/service.go` and the Swagger documents; all
of them merged automatically and still carry their HOHAI behaviour. Revalidated with
`pnpm install --frozen-lockfile`, `pnpm api:check`, `pnpm --filter @deeix/web check`,
`pnpm --filter @deeix/web test:account-plan-identity`, plus Go build, vet and the full test suite.

## Composer tools

- The composer footer keeps only the plus tools menu and one text **智能搜索 / Smart search** toggle on the left; model parameter configuration and Markdown preview controls are intentionally hidden.
- The smart-search toggle directly enables or disables the matched web-search and web-fetch tools for the current composer, without opening an MCP selection card. Other selected tools remain untouched when smart search is toggled off.
- The composer MCP entry is presented as **智能搜索 / Smart search** with a globe icon and an active-state background.
- On accounts that have never saved a default MCP selection, HOHAI automatically enables one web-search tool and one web-fetch tool when the catalog exposes matching tools. Matching is conservative and supports names such as `web_search`, `web_fetch`, `联网搜索`, and `网页抓取`.
- `chat.default_mcp_tool_ids_initialized` distinguishes the HOHAI first-use default from an explicit user choice. Saving any default selection writes this marker as `true`, including an intentionally empty selection.
- The knowledge-base composer button is hidden. Knowledge-base APIs, file processing, `@` resources, and existing conversation behavior remain available.

## Visual layout prompt

- The visual layout prompt is enabled by default for first-time browsers.
- The composer shows a compact Blocks toggle beside the smart-search control. An existing local preference of `false` is still respected, and the prompt continues to be passed to chat requests.

## Billing and account identity

HOHAI only bills by usage, so the customer-facing subscription flow is retired. Admin plan,
redemption and payment configuration management stay untouched.

### Legacy subscribers (stock, not new sales)

Cutting off new sales must not strand the subscribers who already paid, so the backend keeps a
per-user override while the global mode stays `usage`:

- `billing.Service.resolveEffectiveBillingMode` returns `period` for a user that holds an active
  non-free subscription while the global mode is `usage`; every other user keeps the global mode.
  `AuthorizeUsage`, `RecordUsageWithAuthorization`, `BuildUsageLedger` and `GetBillingOverview` go
  through it instead of reading `s.repo.GetBillingMode(ctx)` directly.
- Plan credit therefore still works: `AuthorizeUsage` reserves the current period credit, and
  settlement spends plan credit first and only bills the overage to the usage balance.
- `CreatePaymentOrder` and `SetUserSubscriptionByPlanCode` keep reading the *global* mode, so new
  subscription purchases and admin tier assignment stay blocked while the site is pay-as-you-go.
- `GetBillingOverview` reports `mode: "period"` for those users, so `/setting/subscription` renders a
  compact legacy plan card (`subscriptionPage.legacyPlan` — 订阅中, 剩余额度, 有效期至 and the
  first-credit-then-balance explanation) above the usual balance row, even though
  `billingConfig.mode` stays `usage`.
- When the last legacy subscription expires the override disappears on its own: no data migration,
  ledger rewrite or data backfill is involved, and the site becomes purely pay-as-you-go.
- Covered by `backend/internal/application/billing/service_legacy_subscription_mode_test.go`.

- The settings page `/setting/subscription` is titled **按量计费 / Pay as you go**, and its settings
  sidebar entry is **充值 / Top up** (`settings.subscription`).
- The page keeps the usage summary (a single top-up row), the activity heatmap, the usage trend and
  the usage log. Plan cards, interval/current-plan/entitlement blocks, the plan and payment dialogs
  and the redemption-code dialog are removed from the customer UI.
- The usage summary card starts at the balance line (余额 {value} / Balance {value}) followed by the
  grey 无固定月费，用多少付多少 description — the 按量计费 / Pay as you go heading is rendered once,
  by the page header (`subscriptionPage.title`). Do not reintroduce a second title inside the card,
  and keep `subscriptionPage.usageBilling.title` out of the message catalog.
- `?action=topup` opens the top-up dialog. The legacy `?action=plans` link opens the same dialog so
  old bookmarks and previously pushed routes keep working; both remove the query parameter after load.
- The top-up dialog lays payment channels out as full-width, centred rows. With a single channel
  enabled (HOHAI runs Alipay only) the row spans the dialog and shows the blue Alipay mark from
  `frontend/public/branding/alipay.svg`. Adding a second channel falls back to two columns.
- Client balances stay at two decimals, and `settings.subscriptionPage` keeps only the
  `usageBilling`, `legacyPlan`, `selfMode`, `activity`, `usageTrend`, `usageLog`, `billingTooltip`,
  `payment`, `topUp`, `actions` and `toasts` groups it still renders.
- Sidebar identity has exactly two values, `Free` and `Paid`, covered by
  `pnpm test:account-plan-identity`:
  - An active paid plan or tier, or a positive usage balance, resolves to `Paid`; everything else
    resolves to `Free`.
  - The label follows the user's language: 免费 / 付费 in Chinese and Free / Paid in English
    (`common.freePlan`, `common.paidPlan`). Legacy Pro/Max subscribers now read 付费 / Paid, which is
    intentional because plan tiers are no longer surfaced.
- The sidebar pill and the account-menu entry both use the `Banknote` icon with the 充值 / Top up
  label and link to `/setting/subscription`. `common.upgradePlan` and `common.upgrade` are gone.
- Chat billing guidance is top-up only: `messages.insufficientBalance` and
  `billingGuide.paidModelDescription` no longer mention subscribing, the paid-model dialog shows a
  single full-width 立即充值 action, and the new-chat reminder reads 免费 · 余额 {balance}.

## Time-of-day and campaign pricing

HOHAI mirrors the upstream New API rating rules on the DEEIX side: GPT models use context-length
tiers and DeepSeek models use peak / off-peak periods plus a limited-time campaign. This is a
backend capability the upstream repository does not have, so it has to be re-applied on every sync.

- `billing_model_prices` gained a `time_pricing_json` text column (default `'{}'`), declared in
  `backend/internal/infra/persistence/models/billing.go` and created by
  `applyBillingBaselineIndexes` in `backend/internal/infra/persistence/postgres/postgres.go`.
  Keep both: the Postgres bootstrap is what adds the column on an existing database.
- `ModelPricing.TimePricingJSON` is threaded through the domain type, the Postgres repository
  (upsert map plus `toDomain`) and the HTTP billing DTOs. Re-apply all four if upstream rewrites
  the pricing upsert path.
- The rating logic lives at the end of `backend/internal/application/billing/service.go`
  (`timePricingConfig`, `parseTimePricingConfig`, `normalizeTimePricingJSON`,
  `resolveTimePricingMultiplier`). Semantics match New API's `billing_expr`: the first matching
  period wins, every matching campaign then stacks multiplicatively, and the resulting multiplier
  applies to all chargeable items. Defaults to `Asia/Shanghai` with a fixed-offset fallback for
  images without tzdata. Campaigns support either a recurring `month`/`fromDay`/`beforeDay` window
  or an absolute, self-expiring `startDate`/`endDate` pair (inclusive on both ends).
- `UsageEstimateInput.BillingAt` exists so estimates and the ledger snapshot resolve the same
  instant. The ledger snapshot records `time_pricing_json`, `time_pricing_multiplier` and
  `time_pricing_label`.
- Context-length tiers already exist upstream as `PricingModeTiered`; the tier bucket is
  `input + cacheRead + cacheWrite`, which matches New API's `len` operand. do not change that sum.
- Admin UI: `frontend/features/admin/model/billing-settings.ts` owns the form types, parse /
  stringify / validation helpers, and `frontend/features/admin/components/sections/billing/billing-dialogs.tsx`
  renders the 时段/活动倍率 editor. The matching locale keys live in `adminBilling.modelPricing.timePricing*`.
- Admin amounts must render in the site currency: `billing-settings.ts` holds a module-level
  currency symbol set by `use-admin-billing-reference.ts` from `billingConfig`. Only the
  OpenRouter *catalogue* column keeps `$`, because those reference prices really are USD.
- Regression coverage: `backend/internal/application/billing/service_time_pricing_test.go`.

## Merge rule

When syncing `upstream/dev`, preserve the files and logic listed above, especially the smart-search resolver, the user-settings initialization marker, the visual-prompt default, and the composer button visibility changes.

For billing, re-apply the pay-as-you-go-only customer UI: the 按量计费 page title with a 充值 sidebar
entry, the removed plan/payment/redemption dialogs, the two-value `Free`/`Paid` identity with
language-aware labels, the `Banknote`-based top-up entries, the localised Alipay mark asset, and the
single 按量计费 heading that exists only in the page header (not duplicated inside the summary card).
Upstream may re-introduce `settings.subscriptionPage.plans`, `payment` dialog copy or a
`credit-card` upgrade entry; those must not come back on the customer surface.
The pay-as-you-go switch also carries a backend override: keep `resolveEffectiveBillingMode` and
`hasActivePaidSubscription` resolving `period` for stock subscribers, and keep the
`subscriptionPage.legacyPlan` card. If upstream rewrites `AuthorizeUsage` or `GetBillingOverview`,
re-apply the per-user resolution rather than restoring a direct `s.repo.GetBillingMode(ctx)` read.
