"use client";

import { Globe2 } from "lucide-react";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { InputGroupButton } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { resolveSmartSearchDefaultToolIDs } from "@/features/chat/model/chat-mcp-tool-defaults";
import { cn } from "@/lib/utils";
import type { MCPToolDTO } from "@/shared/api/mcp.types";

const DEFAULT_MCP_TOOL_SELECTION_LIMIT = 32;
const MAX_MCP_TOOL_SELECTION_LIMIT = 128;

type ChatMCPProps = {
  availableTools: MCPToolDTO[];
  selectedToolIDs: number[];
  maxSelectedTools: number;
  disabled: boolean;
  onSelectedToolsChange: (toolIDs: number[]) => void;
};

function resolveToolSelectionLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_MCP_TOOL_SELECTION_LIMIT;
  }
  return Math.min(Math.floor(value), MAX_MCP_TOOL_SELECTION_LIMIT);
}

export function ChatMCP({
  availableTools,
  selectedToolIDs,
  maxSelectedTools,
  disabled,
  onSelectedToolsChange,
}: ChatMCPProps) {
  const tComposer = useTranslations("chat.composer");
  const selectedToolIDSet = React.useMemo(() => new Set(selectedToolIDs), [selectedToolIDs]);
  const smartSearchToolIDs = React.useMemo(() => {
    const selectionLimit = resolveToolSelectionLimit(maxSelectedTools);
    return resolveSmartSearchDefaultToolIDs(availableTools).slice(0, selectionLimit);
  }, [availableTools, maxSelectedTools]);
  const smartSearchToolIDSet = React.useMemo(() => new Set(smartSearchToolIDs), [smartSearchToolIDs]);
  const selectedSmartSearchCount = smartSearchToolIDs.filter((toolID) => selectedToolIDSet.has(toolID)).length;
  const smartSearchEnabled = selectedSmartSearchCount > 0;

  const toggleSmartSearch = React.useCallback(() => {
    if (smartSearchToolIDs.length === 0) {
      return;
    }
    if (smartSearchEnabled) {
      onSelectedToolsChange(selectedToolIDs.filter((toolID) => !smartSearchToolIDSet.has(toolID)));
      return;
    }

    const selectionLimit = resolveToolSelectionLimit(maxSelectedTools);
    const missingToolIDs = smartSearchToolIDs.filter((toolID) => !selectedToolIDSet.has(toolID));
    if (selectedToolIDs.length + missingToolIDs.length > selectionLimit) {
      toast.error(tComposer("mcpToolLimitTitle"), {
        description: tComposer("mcpToolLimitDescription", { limit: selectionLimit }),
      });
      return;
    }
    onSelectedToolsChange([...selectedToolIDs, ...missingToolIDs]);
  }, [
    maxSelectedTools,
    onSelectedToolsChange,
    selectedToolIDSet,
    selectedToolIDs,
    smartSearchEnabled,
    smartSearchToolIDSet,
    smartSearchToolIDs,
    tComposer,
  ]);

  if (smartSearchToolIDs.length === 0) {
    return null;
  }

  const statusLabel = smartSearchEnabled
    ? tComposer("smartSearchEnabled")
    : tComposer("smartSearchDisabled");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <InputGroupButton
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 rounded-md px-2 text-xs font-medium",
            smartSearchEnabled
              ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
          disabled={disabled}
          aria-label={tComposer("smartSearch")}
          aria-pressed={smartSearchEnabled}
          onClick={toggleSmartSearch}
        >
          <Globe2 className="size-4" strokeWidth={1.6} />
          <span>{tComposer("smartSearch")}</span>
        </InputGroupButton>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {statusLabel}
      </TooltipContent>
    </Tooltip>
  );
}
