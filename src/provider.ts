import { inject, provide, reactive, shallowRef } from "vue";
import type { AGUIConfig, AGUIProviderState } from "./core/types";
import { AGUI_INJECTION_KEY } from "./core/types";

/**
 * Provide AG-UI configuration and shared state to descendant components.
 * Call this in a root/layout component's `setup()`.
 */
export function useProvideAGUI(config: AGUIConfig): AGUIProviderState {
  const state: AGUIProviderState = {
    config,
    tools: reactive(new Map()),
    contexts: reactive(new Map()),
    confirmationGates: shallowRef([]),
    toolCallTrackers: shallowRef(new Map()),
    agent: shallowRef(null),
  };

  provide(AGUI_INJECTION_KEY, state);
  return state;
}

/**
 * Retrieve the AG-UI provider state injected by an ancestor `useProvideAGUI()`.
 * Throws if called outside a provider.
 */
export function useAGUI(): AGUIProviderState {
  const state = inject(AGUI_INJECTION_KEY);
  if (!state) {
    throw new Error(
      "[@synoped/ag-ui-vue] useAGUI() called outside of an AG-UI provider. Make sure to call useProvideAGUI() in a parent component or use the createAGUI() plugin.",
    );
  }
  return state;
}
