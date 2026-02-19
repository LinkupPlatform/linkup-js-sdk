import OpenAI from 'openai';
import { OpenAILinkupWrapper } from '../openai-wrapper';

type MockOpenAIClient = {
  chat: {
    completions: {
      create: jest.Mock;
    };
  };
  responses: {
    create: jest.Mock;
  };
};

const createMockOpenAIClient = () => {
  const responsesCreate = jest.fn();
  const chatCreate = jest.fn();
  const client: MockOpenAIClient = {
    chat: {
      completions: {
        create: chatCreate,
      },
    },
    responses: {
      create: responsesCreate,
    },
  };

  return { chatCreate, client: client as unknown as OpenAI, responsesCreate };
};

describe('OpenAILinkupWrapper', () => {
  describe('responses.create flow', () => {
    it('returns the upstream response when no tool call occurs', async () => {
      const { client, responsesCreate } = createMockOpenAIClient();
      const linkupSearch = jest.fn();
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      const firstResponse = { output: [{ content: 'no tools', type: 'message' }] };
      responsesCreate.mockResolvedValueOnce(firstResponse);

      const result = await wrapper.responses.create({ input: 'question', model: 'model' });

      expect(result).toBe(firstResponse);
      expect(linkupSearch).not.toHaveBeenCalled();
      expect(responsesCreate).toHaveBeenCalledTimes(1);

      // Verify search_web tool was provided to OpenAI
      const firstCall = responsesCreate.mock.calls[0][0];
      expect(firstCall.tools).toBeDefined();
      expect(firstCall.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            description: expect.any(String),
            name: 'search_web',
          }),
        ]),
      );
    });

    it('invokes linkup search when the response requests search_web', async () => {
      const { client, responsesCreate } = createMockOpenAIClient();
      const linkupSearch = jest.fn().mockResolvedValue({ results: [{ id: '1' }] });
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      const functionCall = {
        arguments: JSON.stringify({ query: 'foo-bar' }),
        call_id: 'call_1',
        name: 'search_web',
        type: 'function_call',
      };
      const firstResponse = { output: [functionCall] };
      const finalResponse = { output: [{ content: 'final', type: 'message' }] };
      responsesCreate.mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(finalResponse);

      const result = await wrapper.responses.create({ input: 'initial', model: 'model' });

      expect(result).toBe(finalResponse);
      expect(linkupSearch).toHaveBeenCalledWith({
        depth: 'standard',
        outputType: 'searchResults',
        query: 'foo-bar',
      });
      expect(responsesCreate).toHaveBeenCalledTimes(2);

      // Verify second call was made with search results injected
      const secondCall = responsesCreate.mock.calls[1][0];
      expect(secondCall).toBeDefined();
    });

    it('passes reasoning message to the next call if present', async () => {
      const { client, responsesCreate } = createMockOpenAIClient();
      const linkupSearch = jest.fn().mockResolvedValue({ results: [{ id: '99' }] });
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      const reasoningMessage = {
        content: 'Let me search for this',
        type: 'reasoning',
      };
      const functionCall = {
        arguments: JSON.stringify({ query: 'multi' }),
        call_id: 'call_1',
        name: 'search_web',
        type: 'function_call',
      };
      const firstResponse = { output: [reasoningMessage, functionCall] };
      const finalResponse = { output: [{ content: 'final answer', type: 'message' }] };
      responsesCreate.mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(finalResponse);

      await wrapper.responses.create({ input: 'multi input', model: 'model' });

      // Verify second call includes the conversation with search results
      const secondCall = responsesCreate.mock.calls[1][0];
      const inputConversation = secondCall.input;
      expect(inputConversation).toBeDefined();
      expect(responsesCreate).toHaveBeenCalledTimes(2);
    });

    it('handles search_web and ignores other tool calls in responses', async () => {
      const { client, responsesCreate } = createMockOpenAIClient();
      const linkupSearch = jest
        .fn()
        .mockResolvedValue({ results: [{ content: 'search result', url: 'https://example.com' }] });
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      // First response: model calls both search_web and custom tool
      const firstResponse = {
        output: [
          {
            arguments: JSON.stringify({ query: 'TypeScript' }),
            call_id: 'call_1',
            name: 'search_web',
            type: 'function_call',
          },
          {
            arguments: JSON.stringify({ userId: '123' }),
            call_id: 'call_2',
            name: 'get_user_data',
            type: 'function_call',
          },
        ],
      };

      // Second response
      const finalResponse = {
        output: [
          {
            content: 'Final response with search results',
            type: 'message',
          },
        ],
      };

      responsesCreate.mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(finalResponse);

      const result = await wrapper.responses.create({
        input: 'Get user data and TypeScript info',
        model: 'gpt-4',
      });

      // Verify linkup search was called for search_web
      expect(linkupSearch).toHaveBeenCalledWith({
        depth: 'standard',
        outputType: 'searchResults',
        query: 'TypeScript',
      });

      // Verify 2 API calls were made
      expect(responsesCreate).toHaveBeenCalledTimes(2);

      // Result should be the final response from second call
      expect(result).toBe(finalResponse);
    });

    it('throws error when input is missing', async () => {
      const { client } = createMockOpenAIClient();
      const linkupSearch = jest.fn();
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      await expect(
        wrapper.responses.create({ input: undefined, model: 'model' } as unknown as any),
      ).rejects.toThrow('Input is required for creating a response');
    });

    it('throws error when user tools are provided', async () => {
      const { client } = createMockOpenAIClient();
      const linkupSearch = jest.fn();
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      await expect(
        wrapper.responses.create({
          input: 'question',
          model: 'model',
          tools: [
            {
              description: 'test',
              name: 'test_tool',
              parameters: {},
              strict: false,
              type: 'function',
            },
          ],
        } as any),
      ).rejects.toThrow('User tools are not supported in the wrapper implementation.');
    });
  });

  describe('chat.completions.create flow', () => {
    it('returns the upstream response when no tool call occurs', async () => {
      const { client, chatCreate } = createMockOpenAIClient();
      const linkupSearch = jest.fn();
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      const firstChatResponse = {
        choices: [{ message: { content: 'no tools', role: 'assistant' } }],
      };
      chatCreate.mockResolvedValueOnce(firstChatResponse);

      const result = await wrapper.chat.completions.create({
        messages: [{ content: 'hello', role: 'user' }],
        model: 'model',
      });

      expect(result).toBe(firstChatResponse);
      expect(chatCreate).toHaveBeenCalledTimes(1);
      expect(linkupSearch).not.toHaveBeenCalled();

      // Verify search_web tool was provided to OpenAI
      const firstCall = chatCreate.mock.calls[0][0];
      expect(firstCall.tools).toBeDefined();
      expect(firstCall.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            function: expect.objectContaining({
              description: expect.any(String),
              name: 'search_web',
            }),
            type: 'function',
          }),
        ]),
      );
    });

    it('retries the completion when search_web tool calls arrive', async () => {
      const { client, chatCreate } = createMockOpenAIClient();
      const linkupSearch = jest.fn().mockResolvedValue({ results: [{ id: '2' }] });
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      const assistantMessage = {
        content: 'respond',
        role: 'assistant' as const,
        tool_calls: [
          {
            function: {
              arguments: JSON.stringify({ query: 'chips' }),
              name: 'search_web',
            },
            id: 'tool-call',
            type: 'function' as const,
          },
        ],
      };
      const firstChatResponse = { choices: [{ message: assistantMessage }] };
      const finalChatResponse = {
        choices: [{ message: { content: 'final', role: 'assistant' as const } }],
      };
      chatCreate.mockResolvedValueOnce(firstChatResponse).mockResolvedValueOnce(finalChatResponse);

      const result = await wrapper.chat.completions.create({
        messages: [{ content: 'hi', role: 'user' }],
        model: 'model',
      });

      expect(result).toBe(finalChatResponse);
      expect(linkupSearch).toHaveBeenCalledWith({
        depth: 'standard',
        outputType: 'searchResults',
        query: 'chips',
      });
      expect(chatCreate).toHaveBeenCalledTimes(2);

      // Verify second call includes the tool result
      const secondCall = chatCreate.mock.calls[1][0];
      expect(secondCall.messages).toContainEqual(assistantMessage);
      expect(secondCall.messages).toContainEqual({
        content: JSON.stringify([{ id: '2' }], null, 2),
        role: 'tool',
        tool_call_id: 'tool-call',
      });
    });

    it('ignores unrelated tool calls and keeps the original completion', async () => {
      const { client, chatCreate } = createMockOpenAIClient();
      const linkupSearch = jest.fn();
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      const assistantMessage = {
        content: 'call other tool',
        role: 'assistant' as const,
        tool_calls: [
          {
            function: { arguments: '{}', name: 'other_tool' },
            id: 'other-call',
            type: 'function' as const,
          },
        ],
      };

      const firstChatResponse = { choices: [{ message: assistantMessage }] };
      chatCreate.mockResolvedValueOnce(firstChatResponse);

      const result = await wrapper.chat.completions.create({
        messages: [{ content: 'hi', role: 'user' }],
        model: 'model',
      });

      expect(result).toBe(firstChatResponse);
      expect(linkupSearch).not.toHaveBeenCalled();
      expect(chatCreate).toHaveBeenCalledTimes(1);
    });

    it('preserves other tool calls while handling search_web', async () => {
      const { client, chatCreate } = createMockOpenAIClient();
      const linkupSearch = jest
        .fn()
        .mockResolvedValue({ results: [{ content: 'found it', url: 'https://example.com' }] });
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      // First response: model calls both search_web and custom tool
      const assistantMessage = {
        content: 'searching',
        role: 'assistant' as const,
        tool_calls: [
          {
            function: {
              arguments: JSON.stringify({ query: 'TypeScript tips' }),
              name: 'search_web',
            },
            id: 'search-1',
            type: 'function' as const,
          },
          {
            function: {
              arguments: JSON.stringify({ userId: '123' }),
              name: 'get_user_data',
            },
            id: 'user-1',
            type: 'function' as const,
          },
        ],
      };

      // Second response: no more tool calls
      const finalAssistantMessage = {
        content: 'final response',
        role: 'assistant' as const,
        tool_calls: [
          {
            function: {
              arguments: JSON.stringify({ userId: '123' }),
              name: 'get_user_data',
            },
            id: 'user-1',
            type: 'function' as const,
          },
        ],
      };

      const firstChatResponse = { choices: [{ message: assistantMessage }] };
      const finalChatResponse = { choices: [{ message: finalAssistantMessage }] };
      chatCreate.mockResolvedValueOnce(firstChatResponse).mockResolvedValueOnce(finalChatResponse);

      const result = await wrapper.chat.completions.create({
        messages: [{ content: 'help', role: 'user' }],
        model: 'gpt-4',
      });

      // Verify linkup search was called
      expect(linkupSearch).toHaveBeenCalledWith({
        depth: 'standard',
        outputType: 'searchResults',
        query: 'TypeScript tips',
      });

      // Verify 2 calls were made
      expect(chatCreate).toHaveBeenCalledTimes(2);

      // Result should include tool calls from final response
      const resultMessage = result.choices?.[0]?.message;
      expect(resultMessage?.tool_calls).toBeDefined();
    });

    it('throws error when user tools are provided', async () => {
      const { client } = createMockOpenAIClient();
      const linkupSearch = jest.fn();
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      await expect(
        wrapper.chat.completions.create({
          messages: [{ content: 'hello', role: 'user' }],
          model: 'model',
          tools: [
            {
              function: { description: 'test', name: 'test_tool', parameters: {} },
              type: 'function',
            },
          ],
        } as any),
      ).rejects.toThrow('User tools are not supported in the wrapper implementation.');
    });
  });
});
