import type { ShallowRef } from "vue";
import type { State } from "@ag-ui/core";
import type { AbstractAgent } from "@ag-ui/client";

export interface UseAgentStateOptions {
  state: ShallowRef<State>;
  agent: AbstractAgent;
}

export interface UseAgentStateReturn<T> {
  state: ShallowRef<T>;
  setState: (newState: T) => void;
}

/**
 * Typed reactive access to the shared agent state.
 */
export function useAgentState<T = State>(options: UseAgentStateOptions): UseAgentStateReturn<T> {
  const { state } = options;

  function setState(newState: T): void {
    (state as ShallowRef<T>).value = newState;
    options.agent.setState(newState as State);
  }

  return { state: state as ShallowRef<T>, setState };
}
