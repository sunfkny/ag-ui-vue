import { inject, onUnmounted } from "vue";
import type { FrontendTool } from "../core/types";
import { CHAT_REGISTRIES_KEY } from "../core/types";
import type { UseChatReturn } from "./useChat";

export interface UseFrontendToolOptions {
  tool: FrontendTool;
  chat?: UseChatReturn;
}

/**
 * Register a frontend tool that the agent can call.
 */
export function useFrontendTool(options: UseFrontendToolOptions): void {
  const registry = options.chat ? options.chat.toolRegistry : inject(CHAT_REGISTRIES_KEY)?.tools;

  if (!registry) {
    throw new Error(
      "[@synoped/ag-ui-vue] useFrontendTool() could not find a tool registry. Either call it inside a component that is a descendant of useChat(), or pass the chat return object explicitly: useFrontendTool({ tool, chat }).",
    );
  }

  registry.set(options.tool.name, options.tool);

  onUnmounted(() => {
    registry.delete(options.tool.name);
  });
}
