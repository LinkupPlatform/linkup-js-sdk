import OpenAI from 'openai';
import { ChatCompletionTool } from 'openai/resources';
import { Tool } from 'openai/resources/responses/responses.js';
import { ResponseFunctionToolCall } from 'openai/resources/responses/responses.mjs';

export class OpenAILinkupWrapper {
  private clientOpenAI: OpenAI;
  private linkupSearch: any;

  private readonly searchWebDefinition = {
    description:
      'Search the web for current information. Returns comprehensive content from relevant sources.',
    name: 'search_web',
    parameters: {
      properties: {
        query: {
          description: 'The search query',
          type: 'string',
        },
      },
      required: ['query'],
      type: 'object',
    },
  } as const;

  private readonly tools: Tool[] = [
    {
      description: this.searchWebDefinition.description,
      name: this.searchWebDefinition.name,
      parameters: this.searchWebDefinition.parameters,
      strict: false,
      type: 'function',
    },
  ];

  private readonly chatTools: ChatCompletionTool[] = [
    {
      function: {
        description: this.searchWebDefinition.description,
        name: this.searchWebDefinition.name,
        parameters: this.searchWebDefinition.parameters,
      },
      type: 'function' as const,
    },
  ];

  constructor(openAIClient: OpenAI, linkupSearch: any) {
    this.clientOpenAI = openAIClient;
    this.linkupSearch = linkupSearch;
  }

  private searchLinkup = async (query: string) => {
    const response = await this.linkupSearch({
      depth: 'standard',
      outputType: 'searchResults',
      query,
    });

    return response;
  };

  get responses() {
    return {
      create: async (params: OpenAI.Responses.ResponseCreateParamsNonStreaming) => {
        const { model, input, tools, ...otherParams } = params;

        const mergeTools: Tool[] = [...this.tools, ...(tools || [])];

        const response = await this.clientOpenAI.responses.create({
          input,
          model,
          tools: mergeTools,
          ...otherParams,
        });

        const initialInputs = Array.isArray(input) ? input : [input];

        const inputList: string[] = initialInputs.map(item =>
          typeof item === 'string' ? item : JSON.stringify(item),
        );

        const toolCalls = response.output.filter(
          items => items.type === 'function_call' && items.name === this.searchWebDefinition.name,
        ) as ResponseFunctionToolCall[];

        if (toolCalls.length === 0) {
          return response;
        }

        for (const toolCall of toolCalls) {
          const args = JSON.parse(toolCall.arguments);

          const linkupResponse = await this.searchLinkup(args.query);

          inputList.push(JSON.stringify(linkupResponse.results, null, 2));
        }

        // Get final response with linkup results
        const finalResponse = await this.clientOpenAI.responses.create({
          input: inputList.join('\n\n'),
          model,
          tools: mergeTools as any,
          ...otherParams,
        });

        return finalResponse;
      },
    };
  }

  get chat() {
    return {
      completions: {
        create: async (params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) => {
          const { model, messages, tools, stream, ...otherParams } = params;

          const mergedTools = [...this.chatTools, ...(tools || [])];

          const first = await this.clientOpenAI.chat.completions.create({
            messages,
            model,
            tools: mergedTools,
            ...otherParams,
          });

          const assistantMessage = first?.choices?.[0]?.message;
          const toolCalls = assistantMessage?.tool_calls;

          if (!toolCalls || toolCalls.length === 0) {
            return first;
          }

          const nextMessages = [...messages, assistantMessage];

          for (const toolCall of toolCalls) {
            if (toolCall.type !== 'function') continue;
            if (toolCall.function?.name !== this.searchWebDefinition.name) continue;

            const args = JSON.parse(toolCall.function.arguments || '{}');

            const linkupResponse = await this.searchLinkup(args.query);

            nextMessages.push({
              content: JSON.stringify(linkupResponse.results, null, 2),
              role: 'tool',
              tool_call_id: toolCall.id,
            });
          }

          // Get final response with linkup results
          const final = await this.clientOpenAI.chat.completions.create({
            messages: nextMessages,
            model,
            tools: mergedTools,
            ...otherParams,
          });

          return final;
        },
      },
    };
  }
}
