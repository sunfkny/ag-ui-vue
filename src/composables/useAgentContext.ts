import type { Context } from "@ag-ui/core";
import { inject, onUnmounted } from "vue";
import { CHAT_REGISTRIES_KEY } from "../core/types";
import type { UseChatReturn } from "./useChat";

export interface UseAgentContextOptions {
  context: Context;
  chat?: UseChatReturn;
}

/**
 * Register a context entry to be sent with every agent run.
 */
export function useAgentContext(options: UseAgentContextOptions): void {
  const registry = options.chat ? options.chat.contextRegistry : inject(CHAT_REGISTRIES_KEY)?.contexts;

  if (!registry) {
    throw new Error(
      "[@synoped/ag-ui-vue] useAgentContext() could not find a context registry. Either call it inside a component that is a descendant of useChat(), or pass the chat return object explicitly: useAgentContext({ context, chat }).",
    );
  }

  registry.set(options.context.description, options.context);

  onUnmounted(() => {
    registry.delete(options.context.description);
  });
}
