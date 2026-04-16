import { HttpAgent } from "@ag-ui/client";
import type { AbstractAgent } from "@ag-ui/client";
import { onUnmounted, ref, shallowRef, type Ref, type ShallowRef } from "vue";
import type { Message, State } from "@ag-ui/core";
import type { AGUIConfig, ToolCallTracker } from "../core/types";
import { createToolCallTrackerStore, type ToolCallTrackerStore } from "../core/tool-call-tracker";

export interface UseAgentOptions extends AGUIConfig {
  onCustomEvent?: (event: any) => void;
  onRawEvent?: (event: any) => void;
}

export interface UseAgentReturn {
  agent: AbstractAgent;
  messages: ShallowRef<Message[]>;
  state: ShallowRef<State>;
  isRunning: Ref<boolean>;
  reasoning: ShallowRef<{ isActive: boolean; content: string }>;
  toolCallTrackers: ShallowRef<Map<string, ToolCallTracker>>;
  trackerStore: ToolCallTrackerStore;
}

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const agent = new HttpAgent({
    url: options.url,
    headers: options.headers,
    threadId: undefined,
    initialMessages: options.initialMessages,
    initialState: options.initialState,
    debug: options.debug,
  });

  if (options.middleware) agent.use(...options.middleware);

  const messages = shallowRef<Message[]>(agent.messages ? [...agent.messages] : []);
  const state = shallowRef<State>(agent.state ?? {});
  const isRunning = ref(false);
  const reasoning = shallowRef({ isActive: false, content: "" });
  const trackerStore = createToolCallTrackerStore();
  const toolCallTrackers = shallowRef<Map<string, ToolCallTracker>>(new Map());
  const subscriber = agent.subscribe({
    onMessagesChanged({ messages: nextMessages }) {
      messages.value = [...nextMessages];
    },
    onStateChanged({ state: nextState }) {
      state.value = structuredClone(nextState);
    },
    onRunStartedEvent() {
      isRunning.value = true;
    },
    onRunFinishedEvent() {
      isRunning.value = false;
    },
    onRunErrorEvent() {
      isRunning.value = false;
    },
    onToolCallStartEvent({ event }) {
      const e = event as any;
      toolCallTrackers.value = trackerStore.trackStart(e.toolCallId, e.toolCallName);
    },
    onToolCallArgsEvent({ event }) {
      const e = event as any;
      toolCallTrackers.value = trackerStore.appendArgs(e.toolCallId, e.delta);
    },
    onToolCallEndEvent({ event }) {
      const e = event as any;
      toolCallTrackers.value = trackerStore.updateState(e.toolCallId, "input-available");
    },
    onReasoningStartEvent() {
      reasoning.value = { isActive: true, content: "" };
    },
    onReasoningMessageContentEvent({ reasoningMessageBuffer }) {
      reasoning.value = { isActive: true, content: reasoningMessageBuffer ?? "" };
    },
    onReasoningEndEvent() {
      reasoning.value = { ...reasoning.value, isActive: false };
    },
    onCustomEvent({ event }) {
      options.onCustomEvent?.(event);
    },
    onRawEvent({ event }) {
      options.onRawEvent?.(event);
    },
  });

  onUnmounted(() => {
    subscriber.unsubscribe();
  });

  return { agent, messages, state, isRunning, reasoning, toolCallTrackers, trackerStore };
}
