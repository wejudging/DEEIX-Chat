# HOHAI Customizations

This file records HOHAI-specific behavior that must be preserved when merging updates from `upstream/dev`.

Current customization branch: `hohai/custom-branding-billing-v7`.
The behavior below was revalidated against upstream commit `bb4e8fe0` on 2026-09-13.

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
  `usageBilling`, `selfMode`, `activity`, `usageTrend`, `usageLog`, `billingTooltip`, `payment`,
  `topUp`, `actions` and `toasts` groups it still renders.
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

## Merge rule

When syncing `upstream/dev`, preserve the files and logic listed above, especially the smart-search resolver, the user-settings initialization marker, the visual-prompt default, and the composer button visibility changes.

For billing, re-apply the pay-as-you-go-only customer UI: the 按量计费 page title with a 充值 sidebar
entry, the removed plan/payment/redemption dialogs, the two-value `Free`/`Paid` identity with
language-aware labels, the `Banknote`-based top-up entries, the localised Alipay mark asset, and the
single 按量计费 heading that exists only in the page header (not duplicated inside the summary card).
Upstream may re-introduce `settings.subscriptionPage.plans`, `payment` dialog copy or a
`credit-card` upgrade entry; those must not come back on the customer surface.
