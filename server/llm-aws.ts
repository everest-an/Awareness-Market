import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionTool, ChatCompletionMessageToolCall } from "openai/resources/chat/completions";

const openaiApiKey = process.env.OPENAI_API_KEY;
const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true" || process.env.CI === "true";
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

export interface Message {
  role: "system" | "user" | "assistant" | "tool" | "function";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface InvokeParams {
  messages: Message[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: {
    type: "json_schema" | "text";
    json_schema?: {
      name: string;
      strict?: boolean;
      schema: object;
    };
  };
  tools?: ChatCompletionTool[];
  tool_choice?: string | { type: string; function: { name: string } };
}

export interface InvokeResult {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const {
    messages,
    model = "gpt-4o",
    temperature = 0.7,
    max_tokens = 4096,
    response_format,
    tools,
    tool_choice,
  } = params;

  const requestParams: ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })) as any,
    temperature,
    max_tokens,
  };

  if (response_format) {
    requestParams.response_format = response_format as any;
  }

  if (tools) {
    requestParams.tools = tools;
  }

  if (tool_choice) {
    requestParams.tool_choice = tool_choice as any;
  }

  // Fallback for CI/test without real API key: return deterministic mock response
  if (!openai) {
    if (isTestEnv) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: lastUser?.content ? `Mock reply (no OPENAI_API_KEY): ${typeof lastUser.content === "string" ? lastUser.content : "(structured content)"}` : "Mock reply (no OPENAI_API_KEY)",
            },
            finish_reason: "stop",
          },
        ],
        usage: undefined,
      };
    }
    throw new Error("OPENAI_API_KEY is not set; cannot call OpenAI API");
  }

  const response = await openai.chat.completions.create(requestParams);

  return {
    choices: response.choices.map((choice) => ({
      message: {
        role: choice.message.role,
        content: choice.message.content,
        tool_calls: choice.message.tool_calls?.map((tc: ChatCompletionMessageToolCall) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: (tc as any).function?.name || '',
            arguments: (tc as any).function?.arguments || '',
          },
        })),
      },
      finish_reason: choice.finish_reason || "stop",
    })),
    usage: response.usage
      ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        }
      : undefined,
  };
}
