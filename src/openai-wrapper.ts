import OpenAI from 'openai';
import { ChatCompletionMessageFunctionToolCall, ChatCompletionTool } from 'openai/resources';
import { Tool } from 'openai/resources/responses/responses.js';
import { ResponseFunctionToolCall } from 'openai/resources/responses/responses.mjs';
import { SearchParams, SearchResults } from './types';

type LinkupSearchFunction = (
  params: SearchParams & { outputType: 'searchResults' },
) => Promise<SearchResults>;

export class OpenAILinkupWrapper {
  private clientOpenAI: OpenAI;
  private linkupSearch: LinkupSearchFunction;

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

  constructor(openAIClient: OpenAI, linkupSearch: LinkupSearchFunction) {
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

        const first = await this.clientOpenAI.responses.create({
          input,
          model,
          tools: mergeTools,
          ...otherParams,
        });

        const initialInputs = Array.isArray(input) ? input : [input];

        const inputList: string[] = initialInputs.map(item =>
          typeof item === 'string' ? item : JSON.stringify(item),
        );

        const searchWebToolCalls = first.output.filter(
          items => items.type === 'function_call' && items.name === this.searchWebDefinition.name,
        ) as ResponseFunctionToolCall[];

        if (searchWebToolCalls.length === 0) {
          return first;
        }

        for (const toolCall of searchWebToolCalls) {
          const args = JSON.parse(toolCall.arguments);

          const linkupResponse = await this.searchLinkup(args.query);

          inputList.push(JSON.stringify(linkupResponse.results, null, 2));
        }

        // Get final response with linkup results
        const final = await this.clientOpenAI.responses.create({
          input: inputList.join('\n\n'),
          model,
          tools: mergeTools,
          ...otherParams,
        });

        return final;
      },
    };
  }

  get chat() {
    return {
      completions: {
        create: async (params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) => {
          const { model, messages, tools, ...otherParams } = params;

          const mergedTools = [...this.chatTools, ...(tools || [])];

          const first = await this.clientOpenAI.chat.completions.create({
            messages,
            model,
            tools: mergedTools,
            ...otherParams,
          });

          const assistantMessage = first?.choices?.[0]?.message;

          const searchWebToolCalls =
            assistantMessage?.tool_calls?.filter(
              (toolCall): toolCall is ChatCompletionMessageFunctionToolCall =>
                toolCall.type === 'function' &&
                toolCall.function?.name === this.searchWebDefinition.name,
            ) ?? [];

          if (searchWebToolCalls.length === 0) {
            return first;
          }

          const nextMessages = [...messages, assistantMessage];

          for (const toolCall of searchWebToolCalls) {
            const args = JSON.parse(toolCall.function?.arguments || '{}');

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
