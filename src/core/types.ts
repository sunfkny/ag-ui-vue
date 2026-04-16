import type { InjectionKey, ShallowRef } from "vue";
import type { AbstractAgent, Middleware } from "@ag-ui/client";
import type { Message, State, Context } from "@ag-ui/core";

export interface AGUIConfig {
  url: string;
  headers?: Record<string, string>;
  initialMessages?: Message[];
  initialState?: State;
  debug?: boolean;
  middleware?: Middleware[];
}

export interface FrontendTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string>;
  requireConfirmation?: boolean;
}

export type FrontendToolRegistry = Map<string, FrontendTool>;
export type ContextRegistry = Map<string, Context>;

export interface ChatRegistries {
  tools: FrontendToolRegistry;
  contexts: ContextRegistry;
}

export const CHAT_REGISTRIES_KEY: InjectionKey<ChatRegistries> = Symbol("ag-ui-chat-registries");

export type ToolCallState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

export interface ToolCallTracker {
  toolCallId: string;
  toolName: string;
  args: string;
  state: ToolCallState;
  output?: string;
  error?: string;
}

export interface PendingToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: ToolCallState;
}

export interface ConfirmationGate {
  toolCallId: string;
  resolve: (approved: boolean, reason?: string) => void;
}

export interface AGUIProviderState {
  config: AGUIConfig;
  tools: FrontendToolRegistry;
  contexts: ContextRegistry;
  confirmationGates: ShallowRef<ConfirmationGate[]>;
  toolCallTrackers: ShallowRef<Map<string, ToolCallTracker>>;
  agent: ShallowRef<AbstractAgent | null>;
}

export const AGUI_INJECTION_KEY: InjectionKey<AGUIProviderState> = Symbol("@synoped/ag-ui-vue");
