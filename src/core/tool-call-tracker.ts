import type { ToolCallState, ToolCallTracker } from "./types";

/**
 * Creates a reactive-friendly tool call tracking store.
 * Returns a new Map on every mutation so Vue shallowRef triggers.
 */
export function createToolCallTrackerStore() {
  let trackers = new Map<string, ToolCallTracker>();

  function snapshot() {
    return new Map(trackers);
  }

  function trackStart(toolCallId: string, toolName: string) {
    trackers = new Map(trackers);
    trackers.set(toolCallId, {
      toolCallId,
      toolName,
      args: "",
      state: "input-streaming",
    });
    return trackers;
  }

  function appendArgs(toolCallId: string, delta: string) {
    const existing = trackers.get(toolCallId);
    if (existing) {
      trackers = new Map(trackers);
      trackers.set(toolCallId, { ...existing, args: existing.args + delta });
    }
    return trackers;
  }

  function updateState(
    toolCallId: string,
    state: ToolCallState,
    extra?: { output?: string; error?: string },
  ) {
    const existing = trackers.get(toolCallId);
    if (existing) {
      trackers = new Map(trackers);
      trackers.set(toolCallId, { ...existing, state, ...extra });
    }
    return trackers;
  }

  function getTracker(toolCallId: string) {
    return trackers.get(toolCallId);
  }

  return { snapshot, trackStart, appendArgs, updateState, getTracker };
}

export type ToolCallTrackerStore = ReturnType<typeof createToolCallTrackerStore>;
