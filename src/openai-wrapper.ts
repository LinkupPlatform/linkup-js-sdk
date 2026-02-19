import OpenAI from 'openai';
import { ChatCompletionMessageFunctionToolCall, ChatCompletionTool } from 'openai/resources';
import { ResponseInput, Tool } from 'openai/resources/responses/responses.js';
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

  private readonly responseTools: Tool[] = [
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

        if (!input) {
          throw new Error('Input is required for creating a response');
        }

        if (tools) {
          throw new Error('User tools are not supported in the wrapper implementation.');
        }

        const conversation: ResponseInput = Array.isArray(input)
          ? input
          : [{ content: input, role: 'user' }];

        const first = await this.clientOpenAI.responses.create({
          input: conversation,
          model,
          tools: this.responseTools,
          ...otherParams,
        });

        const searchWebToolCalls = first.output.filter(
          items => items.type === 'function_call' && items.name === this.searchWebDefinition.name,
        ) as ResponseFunctionToolCall[];

        if (searchWebToolCalls.length === 0) {
          return first;
        }

        conversation.push(...first.output);

        for (const toolCall of searchWebToolCalls) {
          const args = JSON.parse(toolCall.arguments);

          const linkupResponse = await this.searchLinkup(args.query);

          conversation.push({
            call_id: toolCall.call_id,
            output: JSON.stringify(
              linkupResponse.results
                .map(result => ('content' in result ? result.content : ''))
                .join('\n'),
            ),
            type: 'function_call_output',
          });
        }

        const final = await this.clientOpenAI.responses.create({
          input: conversation,
          model,
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

          if (tools) {
            throw new Error('User tools are not supported in the wrapper implementation.');
          }

          const first = await this.clientOpenAI.chat.completions.create({
            messages,
            model,
            tools: this.chatTools,
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

          const final = await this.clientOpenAI.chat.completions.create({
            messages: nextMessages,
            model,
            ...otherParams,
          });

          return final;
        },
      },
    };
  }
}
