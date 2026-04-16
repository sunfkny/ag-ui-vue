import { nextTick } from "vue";
import type { AbstractAgent, RunAgentResult } from "@ag-ui/client";
import type { Context, Tool } from "@ag-ui/core";
import type { ConfirmationGate, FrontendToolRegistry, ToolCallTracker } from "./types";
import type { ToolCallTrackerStore } from "./tool-call-tracker";

export interface ToolExecutorOptions {
  agent: AbstractAgent;
  tools: FrontendToolRegistry;
  trackerStore: ToolCallTrackerStore;
  getToolDefinitions: () => Tool[];
  getContexts: () => Context[];
  onConfirmationRequired: (gate: ConfirmationGate) => void;
  onConfirmationResolved: (toolCallId: string) => void;
  onTrackersChanged: (trackers: Map<string, ToolCallTracker>) => void;
}

function getExecutableToolCalls(result: RunAgentResult, tools: FrontendToolRegistry) {
  const executable: Array<{
    toolCall: NonNullable<Extract<RunAgentResult["newMessages"][number], { role: "assistant" }>["toolCalls"]>[number];
    tool: FrontendToolRegistry extends Map<string, infer T> ? T : never;
  }> = [];

  for (const message of result.newMessages) {
    if (message.role !== "assistant") continue;
    if (!message.toolCalls) continue;

    for (const toolCall of message.toolCalls) {
      const tool = tools.get(toolCall.function.name);
      if (tool) executable.push({ toolCall, tool });
    }
  }

  return executable;
}

function waitForConfirmation(toolCallId: string, options: ToolExecutorOptions) {
  return new Promise<boolean>((resolve) => {
    options.onConfirmationRequired({
      toolCallId,
      resolve: (approved) => {
        options.onConfirmationResolved(toolCallId);
        resolve(approved);
      },
    });
  });
}

/**
 * Scan new messages from a runAgent result for tool calls that match
 * registered frontend tools. Execute them (with optional confirmation
 * gate), append ToolMessages, and re-run the agent.
 */
export async function executeToolCalls(result: RunAgentResult, options: ToolExecutorOptions): Promise<void> {
  const executableCalls = getExecutableToolCalls(result, options.tools);
  if (executableCalls.length === 0) return;

  const { agent, trackerStore, onTrackersChanged } = options;

  for (const { toolCall, tool } of executableCalls) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolCall.function.arguments || "{}");
    } catch {
      args = {};
    }

    if (tool.requireConfirmation) {
      onTrackersChanged(trackerStore.updateState(toolCall.id, "approval-requested"));

      const approved = await waitForConfirmation(toolCall.id, options);
      if (!approved) {
        onTrackersChanged(trackerStore.updateState(toolCall.id, "output-denied"));
        agent.addMessage({
          id: `tool-result-${toolCall.id}`,
          role: "tool",
          toolCallId: toolCall.id,
          content: "Tool execution denied by user.",
        });
        continue;
      }

      onTrackersChanged(trackerStore.updateState(toolCall.id, "approval-responded"));
    }

    try {
      const output = await tool.handler(args);
      onTrackersChanged(trackerStore.updateState(toolCall.id, "output-available", { output }));
      agent.addMessage({
        id: `tool-result-${toolCall.id}`,
        role: "tool",
        toolCallId: toolCall.id,
        content: output,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onTrackersChanged(trackerStore.updateState(toolCall.id, "output-error", { error: message }));
      agent.addMessage({
        id: `tool-result-${toolCall.id}`,
        role: "tool",
        toolCallId: toolCall.id,
        content: `Error: ${message}`,
      });
    }
  }

  await nextTick();

  const rerun = await agent.runAgent({
    tools: options.getToolDefinitions(),
    context: options.getContexts(),
  });

  await executeToolCalls(rerun, options);
}
