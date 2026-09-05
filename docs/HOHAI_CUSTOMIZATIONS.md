# HOHAI Customizations

This file records HOHAI-specific behavior that must be preserved when merging updates from `upstream/dev`.

Current customization branch: `hohai/custom-branding-billing-v7`.
The behavior below was revalidated against upstream commit `1a95cb0a` on 2026-09-05.

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

## Merge rule

When syncing `upstream/dev`, preserve the files and logic listed above, especially the smart-search resolver, the user-settings initialization marker, the visual-prompt default, and the composer button visibility changes.
