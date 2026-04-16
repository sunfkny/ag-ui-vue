import type { ComputedRef, ShallowRef } from "vue";
import type { ConfirmationGate, PendingToolCall } from "../core/types";

export interface UseToolConfirmationOptions {
  pendingToolCalls: ComputedRef<PendingToolCall[]>;
  confirmationGates: ShallowRef<ConfirmationGate[]>;
  approve: (toolCallId: string) => void;
  reject: (toolCallId: string, reason?: string) => void;
}

export interface UseToolConfirmationReturn {
  pendingToolCalls: ComputedRef<PendingToolCall[]>;
  approve: (toolCallId: string) => void;
  reject: (toolCallId: string, reason?: string) => void;
}

export function useToolConfirmation(options: UseToolConfirmationOptions): UseToolConfirmationReturn {
  return {
    pendingToolCalls: options.pendingToolCalls,
    approve: options.approve,
    reject: options.reject,
  };
}
