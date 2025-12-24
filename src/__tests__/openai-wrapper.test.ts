import OpenAI from 'openai';
import { OpenAILinkupWrapper } from '../openai-wrapper';

const createMockOpenAIClient = () => {
  const responsesCreate = jest.fn();
  const chatCreate = jest.fn();
  const client = {
    chat: {
      completions: {
        create: chatCreate,
      },
    },
    responses: {
      create: responsesCreate,
    },
  } as unknown as OpenAI;

  return { chatCreate, client, responsesCreate };
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
      expect(responsesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'question',
          model: 'model',
          tools: expect.arrayContaining([]),
        }),
      );
    });

    it('invokes linkup search when the response requests search_web', async () => {
      const { client, responsesCreate } = createMockOpenAIClient();
      const linkupSearch = jest.fn().mockResolvedValue({ results: [{ id: '1' }] });
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      const functionCall = {
        arguments: JSON.stringify({ query: 'foo-bar' }),
        name: 'search_web',
        type: 'function_call',
      };
      const firstResponse = { output: [functionCall] };
      const finalResponse = { final: true };
      responsesCreate.mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(finalResponse);

      const result = await wrapper.responses.create({ input: 'initial', model: 'model' });

      expect(result).toBe(finalResponse);
      expect(linkupSearch).toHaveBeenCalledWith({
        depth: 'standard',
        outputType: 'searchResults',
        query: 'foo-bar',
      });
      expect(responsesCreate).toHaveBeenCalledTimes(2);
      expect(responsesCreate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          input: expect.stringContaining('initial'),
          tools: expect.arrayContaining([]),
        }),
      );
    });

    it('appends JSON-serialized inputs and results before the second call', async () => {
      const { client, responsesCreate } = createMockOpenAIClient();
      const linkupSearch = jest.fn().mockResolvedValue({ results: [{ id: '99' }] });
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      const functionCall = {
        arguments: JSON.stringify({ query: 'multi' }),
        name: 'search_web',
        type: 'function_call',
      };
      const firstResponse = { output: [functionCall] };
      const finalResponse = { final: true };
      responsesCreate.mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(finalResponse);

      const inputs: OpenAI.Responses.ResponseCreateParamsNonStreaming['input'] = [
        { content: 'multi', role: 'user' },
      ];
      await wrapper.responses.create({ input: inputs, model: 'model' });

      const secondCallInput = responsesCreate.mock.calls[1][0].input as string;
      expect(secondCallInput).toContain(JSON.stringify(inputs[0]));
      expect(secondCallInput).toContain(JSON.stringify([{ id: '99' }], null, 2));
    });
  });

  describe('chat.completions.create flow', () => {
    it('retries the completion when search_web tool calls arrive', async () => {
      const { client, chatCreate } = createMockOpenAIClient();
      const linkupSearch = jest.fn().mockResolvedValue({ results: [{ id: '2' }] });
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      const assistantMessage = {
        content: 'respond',
        role: 'assistant',
        tool_calls: [
          {
            function: {
              arguments: JSON.stringify({ query: 'chips' }),
              name: 'search_web',
            },
            id: 'tool-call',
            type: 'function',
          },
        ],
      };
      const firstChatResponse = { choices: [{ message: assistantMessage }] };
      const finalChatResponse = { final: true };
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
      const secondCall = chatCreate.mock.calls[1][0];
      expect(secondCall.messages).toContainEqual(assistantMessage);
      expect(secondCall.messages).toContainEqual({
        content: JSON.stringify([{ id: '2' }], null, 2),
        role: 'tool',
        tool_call_id: 'tool-call',
      });
    });

    it('returns the first completion when no tool calls are issued', async () => {
      const { client, chatCreate } = createMockOpenAIClient();
      const linkupSearch = jest.fn();
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      const firstChatResponse = {
        choices: [{ message: { content: 'ok', role: 'assistant' } }],
      };
      chatCreate.mockResolvedValueOnce(firstChatResponse);

      const result = await wrapper.chat.completions.create({
        messages: [{ content: 'hello', role: 'user' }],
        model: 'model',
      });

      expect(result).toBe(firstChatResponse);
      expect(chatCreate).toHaveBeenCalledTimes(1);
      expect(linkupSearch).not.toHaveBeenCalled();
    });

    it('ignores unrelated tool calls and keeps the original completion', async () => {
      const { client, chatCreate } = createMockOpenAIClient();
      const linkupSearch = jest.fn();
      const wrapper = new OpenAILinkupWrapper(client, linkupSearch);

      const assistantMessage = {
        content: 'call other tool',
        role: 'assistant',
        tool_calls: [
          {
            function: { arguments: '{}', name: 'other_tool' },
            id: 'other-call',
            type: 'function',
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
  });
});
