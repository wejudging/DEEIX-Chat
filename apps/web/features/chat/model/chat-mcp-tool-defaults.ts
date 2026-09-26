import type { MCPToolDTO } from "@/shared/api/mcp.types";

export const DEFAULT_MCP_TOOLS_SETTING_KEY = "chat.default_mcp_tool_ids";
export const DEFAULT_MCP_TOOLS_INITIALIZED_SETTING_KEY = "chat.default_mcp_tool_ids_initialized";

const WEB_CONTEXT_PATTERN = /(?:web|internet|browser|联网|网络|网页)/i;
const SEARCH_PATTERN = /(?:web[\s_-]*search|search[\s_-]*web|internet[\s_-]*search|联网搜索|网络搜索|网页搜索|搜索网页)/i;
const FETCH_PATTERN = /(?:web[\s_-]*fetch|fetch[\s_-]*web|fetch[\s_-]*page|crawl(?:ing)?|网页抓取|抓取网页|网页读取|读取网页|网页访问)/i;
const GENERIC_SEARCH_PATTERN = /(?:^|[\s_-])(?:search|搜索|查询)(?:$|[\s_-])/i;
const GENERIC_FETCH_PATTERN = /(?:^|[\s_-])(?:fetch|crawl|抓取|读取|浏览)(?:$|[\s_-])/i;

function toolIdentity(tool: MCPToolDTO): string {
  return [tool.name, tool.displayName].filter(Boolean).join(" ").trim();
}

function toolMetadata(tool: MCPToolDTO): string {
  return [tool.serverName, tool.description].filter(Boolean).join(" ").trim();
}

function isSmartSearchTool(tool: MCPToolDTO): boolean {
  const identity = toolIdentity(tool);
  const metadata = toolMetadata(tool);
  if (/(?:image|图片|图像)/i.test(identity)) {
    return false;
  }
  return SEARCH_PATTERN.test(identity) || (WEB_CONTEXT_PATTERN.test(metadata) && GENERIC_SEARCH_PATTERN.test(identity));
}

function isSmartFetchTool(tool: MCPToolDTO): boolean {
  const identity = toolIdentity(tool);
  const metadata = toolMetadata(tool);
  if (/(?:image|图片|图像)/i.test(identity)) {
    return false;
  }
  return FETCH_PATTERN.test(identity) || (WEB_CONTEXT_PATTERN.test(metadata) && GENERIC_FETCH_PATTERN.test(identity));
}

export function parseDefaultMCPToolIDs(raw: string | null | undefined): number[] {
  const value = raw?.trim();
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const seen = new Set<number>();
    const result: number[] = [];
    for (const item of parsed) {
      const id = typeof item === "number" ? item : Number(item);
      if (Number.isSafeInteger(id) && id > 0 && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function normalizeAvailableMCPTools(tools: MCPToolDTO[]): MCPToolDTO[] {
  const seen = new Set<number>();
  return tools.filter((tool) => {
    if (!Number.isSafeInteger(tool.id) || tool.id <= 0 || seen.has(tool.id)) {
      return false;
    }
    const status = typeof tool.status === "string" ? tool.status.trim() : "";
    if (status && status !== "active") {
      return false;
    }
    seen.add(tool.id);
    return true;
  });
}

export function filterAvailableMCPToolIDs(
  toolIDs: number[],
  tools: MCPToolDTO[],
  limit?: number,
): number[] {
  const availableIDs = new Set(tools.map((tool) => tool.id));
  const result = toolIDs.filter((id) => availableIDs.has(id));
  return typeof limit === "number" && limit >= 0 ? result.slice(0, limit) : result;
}

/**
 * Resolve the two HOHAI smart-search defaults from the currently available MCP catalog.
 * Matching is intentionally conservative so unrelated search or fetch tools are not enabled.
 */
export function resolveSmartSearchDefaultToolIDs(tools: MCPToolDTO[]): number[] {
  const availableTools = normalizeAvailableMCPTools(tools);
  const searchTool = availableTools.find(isSmartSearchTool);
  const fetchTool = availableTools.find((tool) => tool.id !== searchTool?.id && isSmartFetchTool(tool));
  return [searchTool?.id, fetchTool?.id].filter((id): id is number => typeof id === "number");
}
