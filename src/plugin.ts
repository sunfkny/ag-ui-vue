import { reactive, shallowRef } from "vue";
import type { Plugin } from "vue";
import type { AGUIConfig } from "./core/types";
import { AGUI_INJECTION_KEY } from "./core/types";

/**
 * Create a Vue plugin that installs the AG-UI provider at the app level.
 *
 * ```ts
 * const app = createApp(App)
 * app.use(createAGUI({ url: 'http://localhost:8000' }))
 * ```
 */
export function createAGUI(config: AGUIConfig): Plugin {
  return {
    install(app) {
      app.provide(AGUI_INJECTION_KEY, {
        config,
        tools: reactive(new Map()),
        contexts: reactive(new Map()),
        confirmationGates: shallowRef([]),
        toolCallTrackers: shallowRef(new Map()),
        agent: shallowRef(null),
      });
    },
  };
}
