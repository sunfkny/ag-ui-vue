import type { Message, ToolCall } from "@ag-ui/core";
import type { ToolCallState, ToolCallTracker } from "../core/types";

export interface AdaptedUIMessage {
  id: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
  parts?: AdaptedPart[];
  toolInvocations?: AdaptedToolInvocation[];
}

export type AdaptedPart =
  | { type: "text"; text: string }
  | { type: "reasoning"; reasoning: string }
  | { type: "tool-invocation"; toolInvocation: AdaptedToolInvocation };

export interface AdaptedToolInvocation {
  toolCallId: string;
  toolName: string;
  state: ToolCallState;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
}

export type AdaptedChatStatus = "ready" | "submitted" | "streaming" | "error";

export interface AdaptedToolUIPart {
  type: "tool-invocation";
  toolCallId: string;
  toolName: string;
  state: ToolCallState;
  args: Record<string, unknown>;
  result?: string;
}

export function toUIMessages(messages: Message[], trackers?: Map<string, ToolCallTracker>): AdaptedUIMessage[] {
  const result: AdaptedUIMessage[] = [];

  for (const message of messages) {
    switch (message.role) {
      case "user": {
        const content = typeof message.content === "string" ? message.content : "";
        result.push({
          id: message.id,
          role: "user",
          content,
          parts: [{ type: "text", text: content }],
        });
        break;
      }
      case "assistant": {
        const parts: AdaptedPart[] = [];
        const toolInvocations: AdaptedToolInvocation[] = [];

        if (message.content) {
          parts.push({ type: "text", text: message.content });
        }

        if (message.toolCalls) {
          for (const toolCall of message.toolCalls) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(toolCall.function.arguments || "{}");
            } catch {
              args = {};
            }

            const tracker = trackers?.get(toolCall.id);
            const toolInvocation: AdaptedToolInvocation = {
              toolCallId: toolCall.id,
              toolName: toolCall.function.name,
              state: tracker?.state ?? "input-available",
              args,
              result: tracker?.output,
              error: tracker?.error,
            };

            toolInvocations.push(toolInvocation);
            parts.push({ type: "tool-invocation", toolInvocation });
          }
        }

        result.push({
          id: message.id,
          role: "assistant",
          content: message.content ?? "",
          parts,
          toolInvocations,
        });
        break;
      }
      case "tool": {
        const lastAssistant = findLastAssistant(result);
        if (lastAssistant) {
          const invocation = lastAssistant.toolInvocations?.find((item) => item.toolCallId === message.toolCallId);
          if (invocation) {
            invocation.result = message.content;
            if (!invocation.error && message.content.startsWith("Error:")) {
              invocation.state = "output-error";
              invocation.error = message.content;
            } else if (invocation.state !== "output-denied" && invocation.state !== "output-error") {
              invocation.state = "output-available";
            }
          }
        }
        break;
      }
      case "reasoning": {
        result.push({
          id: message.id,
          role: "assistant",
          content: "",
          parts: [{ type: "reasoning", reasoning: message.content }],
        });
        break;
      }
      case "activity": {
        result.push({
          id: message.id,
          role: "data",
          content: JSON.stringify(message.content ?? {}),
        });
        break;
      }
      case "developer":
      case "system": {
        result.push({
          id: message.id,
          role: "system",
          content: message.content ?? "",
        });
        break;
      }
    }
  }

  return result;
}

function findLastAssistant(messages: AdaptedUIMessage[]): AdaptedUIMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "assistant") return messages[i];
  }
}

export function toChatStatus(phase: "idle" | "submitted" | "streaming" | "error"): AdaptedChatStatus {
  switch (phase) {
    case "idle":
      return "ready";
    case "submitted":
      return "submitted";
    case "streaming":
      return "streaming";
    case "error":
      return "error";
  }
}

export function toToolUIParts(
  toolCalls: ToolCall[],
  trackers: Map<string, ToolCallTracker>,
): AdaptedToolUIPart[] {
  return toolCalls.map((toolCall) => {
    const tracker = trackers.get(toolCall.id);
    let args: Record<string, unknown> = {};

    try {
      args = JSON.parse(toolCall.function.arguments || "{}");
    } catch {
      args = {};
    }

    return {
      type: "tool-invocation",
      toolCallId: toolCall.id,
      toolName: toolCall.function.name,
      state: tracker?.state ?? "input-available",
      args,
      result: tracker?.output,
    };
  });
}
