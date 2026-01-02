import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  tools?: any[];
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

  const requestParams: any = {
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature,
    max_tokens,
  };

  if (response_format) {
    requestParams.response_format = response_format;
  }

  if (tools) {
    requestParams.tools = tools;
  }

  if (tool_choice) {
    requestParams.tool_choice = tool_choice;
  }

  const response = await openai.chat.completions.create(requestParams);

  return {
    choices: response.choices.map((choice) => ({
      message: {
        role: choice.message.role,
        content: choice.message.content,
        tool_calls: choice.message.tool_calls?.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
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
