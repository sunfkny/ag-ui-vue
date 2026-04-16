# @synoped/ag-ui-vue

Vue 3 composables for the [AG-UI](https://docs.ag-ui.com) protocol. Connect your Vue app to any AG-UI compatible AI agent with reactive messages, streaming, frontend tool execution, and human-in-the-loop confirmation.

## Install

```bash
npm install @synoped/ag-ui-vue vue
```

`vue` >= 3.5 is a peer dependency.

## Quick Start

The fastest way to get a chat working:

```vue
<script setup lang="ts">
import { useChat } from "@synoped/ag-ui-vue";

const { messages, status, send } = useChat({
  url: "http://localhost:8000",
});

const input = ref("");

async function handleSend() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await send(text);
}
</script>

<template>
  <div v-for="msg in messages" :key="msg.id">
    <strong>{{ msg.role }}:</strong> {{ msg.content }}
  </div>
  <input v-model="input" @keydown.enter="handleSend" />
  <button @click="handleSend" :disabled="status !== 'ready'">Send</button>
</template>
```

That's it. `useChat` handles the connection, message state, and streaming for you.

---

## API

### `useChat` — High-Level Chat

The main composable. Manages messages, status, tool execution, and confirmation in one call.

```ts
const {
  messages,          // ShallowRef<Message[]>
  status,            // Ref<'ready' | 'submitted' | 'streaming' | 'error'>
  error,             // ShallowRef<Error | null>
  state,             // ShallowRef<State> — shared agent state
  reasoning,         // ShallowRef<{ isActive: boolean; content: string }>
  toolCallTrackers,  // ShallowRef<Map<string, ToolCallTracker>>
  pendingToolCalls,  // ComputedRef<PendingToolCall[]>
  send,              // (content: string, opts?) => Promise<void>
  stop,              // () => void — abort the current run
  approve,           // (toolCallId: string) => void
  reject,            // (toolCallId: string, reason?: string) => void
  agent,             // the underlying AbstractAgent instance
} = useChat(options);
```

#### Options

```ts
useChat({
  url: "http://localhost:8000",       // required — your AG-UI backend
  headers: { Authorization: "..." },  // optional — custom headers
  threadId: "thread-123",             // optional — resume a conversation
  initialMessages: [],                // optional — seed messages
  initialState: {},                   // optional — seed state
  forwardedProps: { userId: "abc" },  // optional — extra data sent each run
  debug: true,                        // optional — log events
  middleware: [myMiddleware],          // optional — AG-UI client middleware
  onError: (err) => {},               // optional — error callback
  onFinish: (result) => {},           // optional — run complete callback
  onCustomEvent: (event) => {},       // optional — custom event handler
  onRawEvent: (event) => {},          // optional — raw event handler
});
```

#### Status Lifecycle

```
ready → submitted → streaming → ready
                  ↘ error
```

- **ready** — idle, can send a message
- **submitted** — message sent, waiting for first response
- **streaming** — receiving text or tool call data
- **error** — something went wrong (check `error.value`)

---

### `useAgent` — Low-Level Agent Access

If you need full control over the agent without the chat layer:

```ts
import { useAgent } from "@synoped/ag-ui-vue";

const {
  agent,             // AbstractAgent — call agent.runAgent() yourself
  messages,          // ShallowRef<Message[]>
  state,             // ShallowRef<State>
  isRunning,         // Ref<boolean>
  reasoning,         // ShallowRef<{ isActive: boolean; content: string }>
  toolCallTrackers,  // ShallowRef<Map<string, ToolCallTracker>>
  trackerStore,      // internal tracker store
} = useAgent({ url: "http://localhost:8000" });

// Run manually
await agent.runAgent({
  tools: [{ name: "search", description: "Search the web", parameters: {} }],
  context: [],
});
```

---

### `useFrontendTool` — Register Browser-Side Tools

Let the agent call functions that run in the browser. Registered tools are automatically included in every `send()` call and cleaned up when the component unmounts.

```vue
<script setup lang="ts">
import { useChat, useFrontendTool } from "@synoped/ag-ui-vue";

const chat = useChat({ url: "http://localhost:8000" });

useFrontendTool({
  tool: {
    name: "get_location",
    description: "Get the user's current city",
    parameters: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["city", "full"] },
      },
    },
    handler: async (args) => {
      return JSON.stringify({ city: "Toronto", country: "Canada" });
    },
  },
  chat,
});
</script>
```

When the agent decides to call `get_location`, the handler runs locally in the browser and the result is sent back to the agent automatically. The agent then continues with the tool's output.

#### Tools with Confirmation

Add `requireConfirmation: true` to pause and ask the user before executing:

```vue
<script setup lang="ts">
import { useChat, useFrontendTool } from "@synoped/ag-ui-vue";

const chat = useChat({ url: "http://localhost:8000" });
const { pendingToolCalls, approve, reject } = chat;

useFrontendTool({
  tool: {
    name: "delete_file",
    description: "Delete a file from the user's workspace",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
    },
    requireConfirmation: true,
    handler: async (args) => {
      // only runs after user approves
      await deleteFile(args.path as string);
      return "File deleted";
    },
  },
  chat,
});
</script>

<template>
  <!-- Confirmation UI -->
  <div v-for="tc in pendingToolCalls" :key="tc.toolCallId">
    <p>Agent wants to run <strong>{{ tc.toolName }}</strong></p>
    <pre>{{ JSON.stringify(tc.args, null, 2) }}</pre>
    <button @click="approve(tc.toolCallId)">Allow</button>
    <button @click="reject(tc.toolCallId, 'Not allowed')">Deny</button>
  </div>
</template>
```

---

### `useAgentContext` — Send Context to the Agent

Provide extra context that gets included with every agent run. Automatically cleaned up on unmount.

```vue
<script setup lang="ts">
import { useChat, useAgentContext } from "@synoped/ag-ui-vue";

const chat = useChat({ url: "http://localhost:8000" });

useAgentContext({
  context: {
    description: "Current page info",
    value: JSON.stringify({
      route: "/dashboard",
      selectedItems: [1, 2, 3],
    }),
  },
  chat,
});
</script>
```

---

### `useAgentState` — Typed Shared State

Read and write shared state between your app and the agent with type safety:

```vue
<script setup lang="ts">
import { useChat, useAgentState } from "@synoped/ag-ui-vue";

interface AppState {
  counter: number;
  theme: "light" | "dark";
}

const chat = useChat({
  url: "http://localhost:8000",
  initialState: { counter: 0, theme: "light" },
});

const { state, setState } = useAgentState<AppState>({
  state: chat.state,
  agent: chat.agent,
});

function increment() {
  setState({ ...state.value, counter: state.value.counter + 1 });
}
</script>

<template>
  <p>Counter: {{ state.counter }}</p>
  <button @click="increment">+1</button>
</template>
```

The agent can also update this state from its side. Changes flow both ways.

---

### `useToolConfirmation` — Confirmation Helper

A convenience wrapper if you want to handle confirmation in a separate component:

```vue
<script setup lang="ts">
import { useToolConfirmation } from "@synoped/ag-ui-vue";

const props = defineProps<{ chat: ReturnType<typeof useChat> }>();

const { pendingToolCalls, approve, reject } = useToolConfirmation(props.chat);
</script>

<template>
  <div v-for="tc in pendingToolCalls" :key="tc.toolCallId">
    <p>{{ tc.toolName }}: {{ JSON.stringify(tc.args) }}</p>
    <button @click="approve(tc.toolCallId)">Yes</button>
    <button @click="reject(tc.toolCallId)">No</button>
  </div>
</template>
```

---

### Adapters — AI Elements / Vercel AI SDK Compatibility

If you're using [ai-elements-vue](https://github.com/nicepkg/ai-elements-vue) or components that expect Vercel AI SDK message shapes, these adapters bridge the gap:

```ts
import { useChat, toUIMessages, toChatStatus } from "@synoped/ag-ui-vue";

const chat = useChat({ url: "http://localhost:8000" });

// Convert AG-UI messages → ai-elements-vue compatible format
const uiMessages = computed(() =>
  toUIMessages(chat.messages.value, chat.toolCallTrackers.value)
);

// Convert status → ai-elements-vue compatible status
const chatStatus = computed(() => toChatStatus(chat.status.value));
```

#### `toUIMessages(messages, trackers?)`

Converts AG-UI `Message[]` into `AdaptedUIMessage[]` with `parts` and `toolInvocations` — the shape that ai-elements-vue components expect.

#### `toChatStatus(status)`

Maps internal status to the adapted format (`'idle'` becomes `'ready'`).

#### `toToolUIParts(toolCalls, trackers)`

Converts tool calls + tracker state into `AdaptedToolUIPart[]` for rendering tool invocation UI.

---

### Plugin / Provider — App-Level Config

Two ways to share AG-UI config across your app:

#### Option A: Vue Plugin

```ts
// main.ts
import { createApp } from "vue";
import { createAGUI } from "@synoped/ag-ui-vue";
import App from "./App.vue";

const app = createApp(App);
app.use(createAGUI({ url: "http://localhost:8000" }));
app.mount("#app");
```

```vue
<!-- Any descendant component -->
<script setup lang="ts">
import { useAGUI } from "@synoped/ag-ui-vue";

const { config } = useAGUI();
// config.url === 'http://localhost:8000'
</script>
```

#### Option B: Composable Provider

```vue
<!-- Layout.vue -->
<script setup lang="ts">
import { useProvideAGUI } from "@synoped/ag-ui-vue";

const agui = useProvideAGUI({ url: "http://localhost:8000" });
</script>
```

```vue
<!-- ChildComponent.vue -->
<script setup lang="ts">
import { useAGUI } from "@synoped/ag-ui-vue";

const { config } = useAGUI();
</script>
```

---

## Full Example: Chat with Tools and Confirmation

```vue
<script setup lang="ts">
import { ref, computed } from "vue";
import {
  useChat,
  useFrontendTool,
  useAgentContext,
  toUIMessages,
} from "@synoped/ag-ui-vue";

const chat = useChat({ url: "http://localhost:8000" });
const { messages, status, send, pendingToolCalls, approve, reject, toolCallTrackers } = chat;

const input = ref("");

// Register a frontend tool
useFrontendTool({
  tool: {
    name: "get_weather",
    description: "Get current weather for a city",
    parameters: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
    handler: async (args) => {
      const city = args.city as string;
      return JSON.stringify({ city, temp: "22°C", condition: "Sunny" });
    },
  },
  chat,
});

// Register a tool that needs user approval
useFrontendTool({
  tool: {
    name: "send_email",
    description: "Send an email",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
    },
    requireConfirmation: true,
    handler: async (args) => {
      // runs only after user approves
      return "Email sent";
    },
  },
  chat,
});

// Provide context about the current page
useAgentContext({
  context: {
    description: "User info",
    value: JSON.stringify({ name: "Alice", plan: "pro" }),
  },
  chat,
});

// For ai-elements-vue compatibility
const uiMessages = computed(() =>
  toUIMessages(messages.value, toolCallTrackers.value)
);

async function handleSend() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await send(text);
}
</script>

<template>
  <div class="chat">
    <!-- Messages -->
    <div v-for="msg in messages" :key="msg.id" :class="msg.role">
      <strong>{{ msg.role }}:</strong> {{ msg.content }}
    </div>

    <!-- Pending confirmations -->
    <div v-for="tc in pendingToolCalls" :key="tc.toolCallId" class="confirmation">
      <p>Agent wants to call <strong>{{ tc.toolName }}</strong></p>
      <pre>{{ JSON.stringify(tc.args, null, 2) }}</pre>
      <button @click="approve(tc.toolCallId)">Approve</button>
      <button @click="reject(tc.toolCallId)">Reject</button>
    </div>

    <!-- Input -->
    <div class="input-row">
      <input
        v-model="input"
        @keydown.enter="handleSend"
        placeholder="Type a message..."
        :disabled="status === 'submitted' || status === 'streaming'"
      />
      <button @click="handleSend" :disabled="status !== 'ready'">
        {{ status === 'streaming' ? 'Streaming...' : 'Send' }}
      </button>
    </div>
  </div>
</template>
```

---

## How Tool Execution Works

When you register a frontend tool and the agent decides to call it, this happens automatically:

1. **Agent requests tool call** — the backend streams a tool call event
2. **Args stream in** — tracked in `toolCallTrackers` with state `input-streaming` → `input-available`
3. **Confirmation check** — if `requireConfirmation` is set, execution pauses. The tool appears in `pendingToolCalls`. Your UI calls `approve()` or `reject()`
4. **Handler runs** — the tool's `handler` function executes in the browser
5. **Result sent back** — a tool message is added and the agent re-runs with the result
6. **Repeat** — if the agent calls more tools, the cycle continues until no more frontend tools are needed

---

## Types

```ts
interface FrontendTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;          // JSON Schema
  handler: (args: Record<string, unknown>) => Promise<string>;
  requireConfirmation?: boolean;
}

type ToolCallState =
  | "input-streaming"     // args are being received
  | "input-available"     // args complete, ready to execute
  | "approval-requested"  // waiting for user confirmation
  | "approval-responded"  // user responded, executing
  | "output-available"    // handler returned successfully
  | "output-error"        // handler threw an error
  | "output-denied";      // user rejected the tool call

interface ToolCallTracker {
  toolCallId: string;
  toolName: string;
  args: string;           // raw JSON string
  state: ToolCallState;
  output?: string;
  error?: string;
}

interface PendingToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;  // parsed
  state: ToolCallState;
}

interface AGUIConfig {
  url: string;
  headers?: Record<string, string>;
  initialMessages?: Message[];
  initialState?: State;
  debug?: boolean;
  middleware?: Middleware[];
}
```

---

## Example Backend (Python)

The repo includes a minimal Python backend using Google ADK + AG-UI:

```python
# examples/backend/main.py
from google.adk.agents import Agent
from ag_ui_adk import ADKAgent, create_adk_app
from fastapi.middleware.cors import CORSMiddleware

adk_agent = Agent(
    name="assistant",
    model="gemini-2.0-flash",
    instruction="You are a helpful assistant.",
)

agent = ADKAgent(adk_agent=adk_agent, app_name="my-app", user_id="default-user")
app = create_adk_app(agent)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

```bash
# Install deps
pip install google-adk ag-ui-adk fastapi uvicorn

# Set your API key
export GOOGLE_API_KEY=your-key-here

# Run
uvicorn main:app --host 0.0.0.0 --port 8000
```

Or use Docker Compose:

```bash
docker compose --profile example up -d
```

---

## Development

This project uses Docker Compose for development:

```bash
# Start dev container
docker compose up -d ag-ui-vue

# Run tests
docker compose exec ag-ui-vue npx vitest run

# Run tests in watch mode
docker compose exec ag-ui-vue npx vitest

# Type check
docker compose exec ag-ui-vue npx vue-tsc --noEmit

# Build
docker compose exec ag-ui-vue npx vite build

# Lint & format
docker compose exec ag-ui-vue npx eslint src/
docker compose exec ag-ui-vue npx prettier --write src/
```
