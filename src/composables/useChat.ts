import { computed, provide, ref, shallowRef, type ComputedRef, type Ref, type ShallowRef } from "vue";
import type { AbstractAgent, RunAgentResult } from "@ag-ui/client";
import type { Context, Message, State, Tool } from "@ag-ui/core";
import { v4 as uuidv4 } from "uuid";
import { useAgent } from "./useAgent";
import type {
  AGUIConfig,
  ConfirmationGate,
  ContextRegistry,
  FrontendToolRegistry,
  PendingToolCall,
  ToolCallTracker,
  ChatRegistries,
} from "../core/types";
import { CHAT_REGISTRIES_KEY } from "../core/types";
import { executeToolCalls } from "../core/tool-executor";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export interface UseChatOptions extends AGUIConfig {
  threadId?: string;
  forwardedProps?: Record<string, unknown>;
  onError?: (error: Error) => void;
  onFinish?: (result: RunAgentResult) => void;
  onCustomEvent?: (event: any) => void;
  onRawEvent?: (event: any) => void;
}

export interface UseChatReturn {
  messages: ShallowRef<Message[]>;
  status: Ref<ChatStatus>;
  error: ShallowRef<Error | null>;
  state: ShallowRef<State>;
  reasoning: ShallowRef<{ isActive: boolean; content: string }>;
  toolCallTrackers: ShallowRef<Map<string, ToolCallTracker>>;
  pendingToolCalls: ComputedRef<PendingToolCall[]>;
  confirmationGates: ShallowRef<ConfirmationGate[]>;
  send: (content: string, opts?: { forwardedProps?: Record<string, unknown> }) => Promise<void>;
  stop: () => void;
  approve: (toolCallId: string) => void;
  reject: (toolCallId: string, reason?: string) => void;
  agent: AbstractAgent;
  toolRegistry: FrontendToolRegistry;
  contextRegistry: ContextRegistry;
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { agent, messages, state, reasoning, toolCallTrackers, trackerStore } = useAgent({
    ...options,
    onCustomEvent: options.onCustomEvent,
    onRawEvent: options.onRawEvent,
  });

  if (options.threadId) agent.threadId = options.threadId;

  const status = ref<ChatStatus>("ready");
  const error = shallowRef<Error | null>(null);
  const confirmationGates = shallowRef<ConfirmationGate[]>([]);
  const toolRegistry: FrontendToolRegistry = new Map();
  const contextRegistry: ContextRegistry = new Map();

  provide<ChatRegistries>(CHAT_REGISTRIES_KEY, {
    tools: toolRegistry,
    contexts: contextRegistry,
  });

  const sawStreamingEvent = ref(false);
  agent.subscribe({
    onTextMessageContentEvent() {
      if (!sawStreamingEvent.value) {
        sawStreamingEvent.value = true;
        status.value = "streaming";
      }
    },
    onToolCallStartEvent() {
      if (!sawStreamingEvent.value) {
        sawStreamingEvent.value = true;
        status.value = "streaming";
      }
    },
    onRunErrorEvent({ event }) {
      const runError = event as any;
      const err = new Error(runError.message || "Agent run failed");
      error.value = err;
      status.value = "error";
      options.onError?.(err);
    },
  });

  function getToolDefinitions(): Tool[] {
    return Array.from(toolRegistry.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  function getContexts(): Context[] {
    return Array.from(contextRegistry.values());
  }

  const pendingToolCalls = computed<PendingToolCall[]>(() => {
    const calls: PendingToolCall[] = [];

    for (const [, tracker] of toolCallTrackers.value) {
      if (tracker.state !== "approval-requested") continue;

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tracker.args || "{}");
      } catch {
        args = {};
      }

      calls.push({
        toolCallId: tracker.toolCallId,
        toolName: tracker.toolName,
        args,
        state: tracker.state,
      });
    }

    return calls;
  });

  function approve(toolCallId: string): void {
    const gate = confirmationGates.value.find((item) => item.toolCallId === toolCallId);
    if (!gate) return;

    confirmationGates.value = confirmationGates.value.filter((item) => item.toolCallId !== toolCallId);
    gate.resolve(true);
  }

  function reject(toolCallId: string, reason?: string): void {
    const gate = confirmationGates.value.find((item) => item.toolCallId === toolCallId);
    if (!gate) return;

    confirmationGates.value = confirmationGates.value.filter((item) => item.toolCallId !== toolCallId);
    gate.resolve(false, reason);
  }

  async function send(content: string, opts?: { forwardedProps?: Record<string, unknown> }): Promise<void> {
    error.value = null;
    sawStreamingEvent.value = false;
    status.value = "submitted";

    agent.addMessage({
      id: uuidv4(),
      role: "user",
      content,
    });

    try {
      const result = await agent.runAgent({
        tools: getToolDefinitions(),
        context: getContexts(),
        forwardedProps: opts?.forwardedProps ?? options.forwardedProps ?? {},
      });

      await executeToolCalls(result, {
        agent,
        tools: toolRegistry,
        trackerStore,
        getToolDefinitions,
        getContexts,
        onConfirmationRequired(gate) {
          confirmationGates.value = [...confirmationGates.value, gate];
        },
        onConfirmationResolved(toolCallId) {
          confirmationGates.value = confirmationGates.value.filter((gate) => gate.toolCallId !== toolCallId);
        },
        onTrackersChanged(trackers) {
          toolCallTrackers.value = trackers;
        },
      });

      status.value = "ready";
      options.onFinish?.(result);
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(String(err));
      error.value = normalized;
      status.value = "error";
      options.onError?.(normalized);
    }
  }

  function stop(): void {
    agent.abortRun();
  }

  return {
    messages,
    status,
    error,
    state,
    reasoning,
    toolCallTrackers,
    pendingToolCalls,
    confirmationGates,
    send,
    stop,
    approve,
    reject,
    agent,
    toolRegistry,
    contextRegistry,
  };
}
