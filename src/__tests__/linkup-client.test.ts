import axios, { type AxiosResponse } from 'axios';
import { z } from 'zod';
import {
  LinkupAuthenticationError,
  LinkupBudgetLimitExceededError,
  LinkupFetchError,
  LinkupFetchResponseTooLargeError,
  LinkupFetchUnsupportedContentTypeError,
  LinkupInsufficientCreditError,
  LinkupInvalidRequestError,
  LinkupNoResultError,
  LinkupPaymentRequiredError,
  LinkupTaskNotFoundError,
  LinkupTasksQueueLimitExceededError,
  LinkupTooManyRequestsError,
  LinkupUnknownError,
} from '../errors';
import { LinkupClient } from '../linkup-client';
import type { SearchParams, Source } from '../types';
import { refineError } from '../utils/refine-error.utils';
import type { X402Signer } from '../x402/types';

jest.mock('axios');

jest.mock('@x402/core/http', () => ({
  decodePaymentRequiredHeader: jest.fn((header: string) => ({ decoded: header })),
  encodePaymentSignatureHeader: jest.fn((_payload: unknown) => 'signed-payment'),
}));
const maxios = axios as jest.Mocked<typeof axios>;

const mockAxiosInstance = {
  get: jest.fn(),
  interceptors: {
    response: {
      use: jest.fn(),
    },
  },
  post: jest.fn(),
  request: jest.fn(),
  // biome-ignore lint/suspicious/noExplicitAny: testing purpose
} as any;

maxios.create = jest.fn(() => mockAxiosInstance);

describe('LinkupClient', () => {
  const underTest = new LinkupClient({ apiKey: '1234' });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance.get.mockClear();
    mockAxiosInstance.post.mockClear();
  });

  describe('search method', () => {
    it('should make a successful API call with correct parameters', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { answer: '' },
      } as AxiosResponse);

      await underTest.search({
        depth: 'deep',
        outputType: 'sourcedAnswer',
        query: 'foo',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/search', {
        depth: 'deep',
        outputType: 'sourcedAnswer',
        q: 'foo',
      });
    });

    it('should include all valid parameters when provided', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { answer: '' },
      } as AxiosResponse);
      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-01-02');

      await underTest.search({
        depth: 'deep',
        excludeDomains: ['baz.com', 'qux.com'],
        fromDate,
        includeDomains: ['foo.com', 'bar.com'],
        includeImages: true,
        includeInlineCitations: true,
        maxResults: 10,
        outputType: 'sourcedAnswer',
        query: 'foo',
        toDate,
        wrongParameter: 'wrong',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/search', {
        depth: 'deep',
        excludeDomains: ['baz.com', 'qux.com'],
        fromDate: '2025-01-01',
        includeDomains: ['foo.com', 'bar.com'],
        includeImages: true,
        includeInlineCitations: true,
        maxResults: 10,
        outputType: 'sourcedAnswer',
        q: 'foo',
        toDate: '2025-01-02',
      });
    });

    it('should preserve explicit false flags and forward string dates as-is', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { results: [] },
      } as AxiosResponse);

      await underTest.search({
        depth: 'standard',
        fromDate: '2026-05-01',
        includeImages: false,
        includeSources: false,
        outputType: 'structured',
        query: 'foo',
        structuredOutputSchema: { type: 'string' },
        toDate: '2026-05-31',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/search', {
        depth: 'standard',
        fromDate: '2026-05-01',
        includeImages: false,
        includeSources: false,
        outputType: 'structured',
        q: 'foo',
        structuredOutputSchema: JSON.stringify({ type: 'string' }),
        toDate: '2026-05-31',
      });
    });

    it('should forward structured output schemas passed as JSON strings without double encoding', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { results: [] },
      } as AxiosResponse);

      const schema = JSON.stringify({ properties: { foo: { type: 'string' } }, type: 'object' });

      await underTest.search({
        depth: 'standard',
        outputType: 'structured',
        query: 'foo',
        structuredOutputSchema: schema,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/search', {
        depth: 'standard',
        outputType: 'structured',
        q: 'foo',
        structuredOutputSchema: schema,
      });
    });

    it('should use custom base URL if provided', async () => {
      const customMockInstance = {
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
        post: jest.fn(),
        // biome-ignore lint/suspicious/noExplicitAny: testing purpose
      } as any;

      maxios.create = jest.fn(() => customMockInstance);

      const client = new LinkupClient({
        apiKey: '1234',
        baseUrl: 'http://foo.bar/baz',
      });

      customMockInstance.post.mockResolvedValueOnce({
        data: { answer: '' },
      } as AxiosResponse);

      await client.search({
        depth: 'deep',
        outputType: 'sourcedAnswer',
        query: 'foo',
      });

      expect(maxios.create).toHaveBeenCalledWith({
        baseURL: 'http://foo.bar/baz',
        headers: {
          Authorization: 'Bearer 1234',
          'User-Agent': 'Linkup-JS-SDK/0.0.0',
        },
      });
    });

    it('should handle sourcedAnswer output type', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          answer: 'foo',
          sources: [
            {
              favicon: 'http://foo.bar/favicon.ico',
              name: 'foo',
              snippet: 'foo bar baz',
              url: 'http://foo.bar/baz',
            },
            {
              favicon: 'http://bar.baz/favicon.ico',
              name: 'bar',
              snippet: 'bar baz qux',
              url: 'http://bar.baz/qux',
            },
            {
              favicon: 'http://foo.bar/favicon.ico',
              name: 'baz',
              snippet: '',
              url: 'http://baz.qux/foo',
            },
          ],
        },
      } as AxiosResponse);

      const result = await underTest.search({
        depth: 'standard',
        outputType: 'sourcedAnswer',
        query: 'foo',
      });

      expect(result.answer).toEqual('foo');
      expect((result.sources.at(0) as Source)?.name).toEqual('foo');
      expect((result.sources.at(0) as Source)?.url).toEqual('http://foo.bar/baz');
      expect((result.sources.at(0) as Source)?.snippet).toEqual('foo bar baz');
      expect((result.sources.at(0) as Source)?.favicon).toEqual('http://foo.bar/favicon.ico');
      expect((result.sources.at(1) as Source)?.name).toEqual('bar');
      expect((result.sources.at(1) as Source)?.url).toEqual('http://bar.baz/qux');
      expect((result.sources.at(1) as Source)?.snippet).toEqual('bar baz qux');
      expect((result.sources.at(1) as Source)?.favicon).toEqual('http://bar.baz/favicon.ico');
      expect((result.sources.at(2) as Source)?.name).toEqual('baz');
      expect((result.sources.at(2) as Source)?.url).toEqual('http://baz.qux/foo');
      expect((result.sources.at(2) as Source)?.snippet).toEqual('');
      expect((result.sources.at(2) as Source)?.favicon).toEqual('http://foo.bar/favicon.ico');
    });

    it('should handle searchResults output type', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { results: [] },
      } as AxiosResponse);

      const result = await underTest.search({
        depth: 'standard',
        outputType: 'searchResults',
        query: 'foo',
      });

      expect(result).toHaveProperty('results');
    });

    it('should handle structured output type using JSON schema', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          type: 'foo',
        },
      } as AxiosResponse);

      const result = await underTest.search({
        depth: 'standard',
        outputType: 'structured',
        query: 'foo',
        structuredOutputSchema: { type: 'string' },
      });

      expect(result).toEqual({ type: 'foo' });
    });

    it('should handle structured output type using JSON schema with includeSources', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          data: {
            type: 'foo',
          },
          sources: [
            {
              content: 'Lorem ipsum dolor sit amet',
              favicon: 'http://foo.bar/favicon.ico',
              name: 'foo',
              type: 'text',
              url: 'http://foo.bar/baz',
            },
          ],
        },
      } as AxiosResponse);

      const result = await underTest.search({
        depth: 'standard',
        includeSources: true,
        outputType: 'structured',
        query: 'foo',
        structuredOutputSchema: { type: 'string' },
      });

      expect(result).toEqual({
        data: { type: 'foo' },
        sources: [
          {
            content: 'Lorem ipsum dolor sit amet',
            favicon: 'http://foo.bar/favicon.ico',
            name: 'foo',
            type: 'text',
            url: 'http://foo.bar/baz',
          },
        ],
      });
    });

    it('should handle structured output type using Zod schema', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: 'foo',
      } as AxiosResponse);

      await underTest.search({
        depth: 'standard',
        outputType: 'structured',
        query: 'foo',
        structuredOutputSchema: z.object({ foo: z.string() }),
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          q: 'foo',
          structuredOutputSchema: expect.stringContaining('"foo":{"type":"string"}'),
        }),
      );
    });
  });

  describe('fetch method', () => {
    it('should make a successful fetch API call', async () => {
      const mockResponse = { data: { markdown: 'Content' } };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as AxiosResponse);

      const result = await underTest.fetch({
        url: 'https://example.com',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/fetch', {
        url: 'https://example.com',
      });
      expect(result).toEqual({ markdown: 'Content' });
    });

    it('should make a successful fetch API call including raw HTML', async () => {
      const mockResponse = {
        data: { markdown: 'Content', rawHtml: '<h1>Title</h1><p>Content</p>' },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as AxiosResponse);

      const result = await underTest.fetch({
        includeRawHtml: true,
        url: 'https://example.com',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/fetch', {
        includeRawHtml: true,
        url: 'https://example.com',
      });
      expect(result).toEqual({ markdown: 'Content', rawHtml: '<h1>Title</h1><p>Content</p>' });
    });

    it('should handle fetch with renderJS parameter', async () => {
      const mockResponse = { data: { markdown: 'Fetched content' } };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as AxiosResponse);

      await underTest.fetch({
        renderJs: true,
        url: 'https://example.com',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/fetch', {
        renderJs: true,
        url: 'https://example.com',
      });
    });

    it('should handle fetch with extractImages parameter', async () => {
      const mockResponse = {
        data: {
          images: [
            {
              alt: 'Image 1',
              url: 'https://example.com/image.jpg',
            },
          ],
          markdown: 'Fetched content',
        },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse as AxiosResponse);

      const result = await underTest.fetch({
        extractImages: true,
        url: 'https://example.com',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/fetch', {
        extractImages: true,
        url: 'https://example.com',
      });
      expect(result).toEqual({
        images: [
          {
            alt: 'Image 1',
            url: 'https://example.com/image.jpg',
          },
        ],
        markdown: 'Fetched content',
      });
    });
  });

  describe('research methods', () => {
    it('should create a research task and normalize the returned input', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          createdAt: '2026-05-18T00:00:00.000Z',
          error: null,
          id: '2dbcc4bb-2c0d-4bcb-aaf5-44f7cbcf4eee',
          input: {
            mode: 'auto',
            outputType: 'sourcedAnswer',
            q: 'What changed?',
            reasoningDepth: 'L',
          },
          output: null,
          status: 'pending',
          type: 'research',
          updatedAt: '2026-05-18T00:00:00.000Z',
        },
      } as AxiosResponse);

      const result = await underTest.research({
        outputType: 'sourcedAnswer',
        query: 'What changed?',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/research', {
        outputType: 'sourcedAnswer',
        q: 'What changed?',
      });
      expect(result.input).toEqual({
        mode: 'auto',
        outputType: 'sourcedAnswer',
        query: 'What changed?',
        reasoningDepth: 'L',
      });
    });

    it('should get a single research task by id', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          createdAt: '2026-05-18T00:00:00.000Z',
          error: null,
          id: 'abc-123',
          input: {
            mode: 'auto',
            outputType: 'sourcedAnswer',
            q: 'deep question',
            reasoningDepth: 'XL',
          },
          output: { answer: 'result', sources: [] },
          status: 'completed',
          type: 'research',
          updatedAt: '2026-05-18T01:00:00.000Z',
        },
      } as AxiosResponse);

      const result = await underTest.getResearch('abc-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/research/abc-123');
      expect(result.input.query).toBe('deep question');
      expect(result.output).toEqual({ answer: 'result', sources: [] });
    });

    it('should list research tasks with pagination', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              createdAt: '2026-05-18T00:00:00.000Z',
              error: null,
              id: 'r-1',
              input: { outputType: 'sourcedAnswer', q: 'first' },
              output: null,
              status: 'pending',
              type: 'research',
              updatedAt: '2026-05-18T00:00:00.000Z',
            },
          ],
          metadata: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        },
      } as AxiosResponse);

      const result = await underTest.listResearch({ page: 1, pageSize: 10 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/research',
        expect.objectContaining({ params: { page: 1, pageSize: 10 } }),
      );
      expect(result.data[0].input.query).toBe('first');
      expect(result.metadata.total).toBe(1);
    });
  });

  describe('tasks methods', () => {
    it('should create tasks', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: [
          {
            createdAt: '2026-05-18T00:00:00.000Z',
            error: null,
            id: '0fd818f5-5b88-4841-8159-c212ef8e3c34',
            input: {
              depth: 'deep',
              outputType: 'sourcedAnswer',
              q: 'foo',
            },
            output: null,
            status: 'pending',
            type: 'search',
            updatedAt: '2026-05-18T00:00:00.000Z',
          },
          {
            createdAt: '2026-05-18T00:00:00.000Z',
            error: null,
            id: 'c4ea3d1d-764d-4b88-95d0-5328596c4efa',
            input: {
              url: 'https://example.com',
            },
            output: null,
            status: 'pending',
            type: 'fetch',
            updatedAt: '2026-05-18T00:00:00.000Z',
          },
        ],
      } as AxiosResponse);

      const result = await underTest.createTasks([
        {
          input: {
            depth: 'deep',
            outputType: 'sourcedAnswer',
            query: 'foo',
          },
          type: 'search',
        },
        {
          input: {
            url: 'https://example.com',
          },
          type: 'fetch',
        },
      ]);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/tasks', [
        {
          input: {
            depth: 'deep',
            outputType: 'sourcedAnswer',
            q: 'foo',
          },
          type: 'search',
        },
        {
          input: {
            url: 'https://example.com',
          },
          type: 'fetch',
        },
      ]);
      expect(result[0]).toMatchObject({
        input: {
          depth: 'deep',
          outputType: 'sourcedAnswer',
          query: 'foo',
        },
        type: 'search',
      });
      expect(result[1]).toMatchObject({
        input: {
          url: 'https://example.com',
        },
        type: 'fetch',
      });
    });

    it('should get a single task by id', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          createdAt: '2026-05-18T00:00:00.000Z',
          error: null,
          id: 'task-456',
          input: { depth: 'deep', outputType: 'sourcedAnswer', q: 'hello' },
          output: { answer: 'world', sources: [] },
          status: 'completed',
          type: 'search',
          updatedAt: '2026-05-18T01:00:00.000Z',
        },
      } as AxiosResponse);

      const result = await underTest.getTask('task-456');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/tasks/task-456');
      expect(result.type).toBe('search');
      if (result.type === 'search') {
        expect(result.input.query).toBe('hello');
      }
    });

    it('should list tasks with filters and pagination', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              createdAt: '2026-05-18T00:00:00.000Z',
              error: null,
              id: 't-1',
              input: { url: 'https://example.com' },
              output: null,
              status: 'pending',
              type: 'fetch',
              updatedAt: '2026-05-18T00:00:00.000Z',
            },
          ],
          metadata: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
          quota: { inFlight: 1, limit: 100 },
        },
      } as AxiosResponse);

      const result = await underTest.listTasks({ page: 1, pageSize: 5, status: 'pending' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/tasks',
        expect.objectContaining({ params: { page: 1, pageSize: 5, status: 'pending' } }),
      );
      expect(result.data[0].type).toBe('fetch');
      expect(result.quota.inFlight).toBe(1);
    });

    it('should serialize repeated list task filters without array brackets', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [],
          metadata: {
            page: 1,
            pageSize: 10,
            total: 0,
            totalPages: 0,
          },
          quota: {
            inFlight: 0,
            limit: 100,
          },
        },
      } as AxiosResponse);

      await underTest.listTasks({
        status: ['pending', 'processing'],
        type: ['search', 'research'],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/tasks',
        expect.objectContaining({
          params: {
            status: ['pending', 'processing'],
            type: ['search', 'research'],
          },
          paramsSerializer: expect.any(Function),
        }),
      );

      const config = mockAxiosInstance.get.mock.calls[0][1];
      expect(config.paramsSerializer(config.params)).toBe(
        'status=pending&status=processing&type=search&type=research',
      );
    });
  });

  describe('error refinement', () => {
    it.each([
      {
        description: '400 VALIDATION_ERROR',
        ErrorClass: LinkupInvalidRequestError,
        expectedMessage:
          'Validation failed outputType must be one of the following values: sourcedAnswer, searchResults, structured',
        input: {
          error: {
            code: 'VALIDATION_ERROR',
            details: [
              {
                field: 'outputType',
                message:
                  'outputType must be one of the following values: sourcedAnswer, searchResults, structured',
              },
            ],
            message: 'Validation failed',
          },
          statusCode: 400,
        },
      },
      {
        description: '400 SEARCH_QUERY_NO_RESULT',
        ErrorClass: LinkupNoResultError,
        expectedMessage: 'The query did not yield any result',
        input: {
          error: {
            code: 'SEARCH_QUERY_NO_RESULT',
            details: [],
            message: 'The query did not yield any result',
          },
          statusCode: 400,
        },
      },
      {
        description: '400 FETCH_ERROR',
        ErrorClass: LinkupFetchError,
        expectedMessage: 'Failed to fetch the content from the URL',
        input: {
          error: {
            code: 'FETCH_ERROR',
            details: [],
            message: 'Failed to fetch the content from the URL',
          },
          statusCode: 400,
        },
      },
      {
        description: '400 FETCH_RESPONSE_TOO_LARGE',
        ErrorClass: LinkupFetchResponseTooLargeError,
        expectedMessage: 'The fetched response is too large',
        input: {
          error: {
            code: 'FETCH_RESPONSE_TOO_LARGE',
            details: [],
            message: 'The fetched response is too large',
          },
          statusCode: 400,
        },
      },
      {
        description: '400 FETCH_UNSUPPORTED_CONTENT_TYPE',
        ErrorClass: LinkupFetchUnsupportedContentTypeError,
        expectedMessage: 'The URL returned an unsupported content type',
        input: {
          error: {
            code: 'FETCH_UNSUPPORTED_CONTENT_TYPE',
            details: [],
            message: 'The URL returned an unsupported content type',
          },
          statusCode: 400,
        },
      },
      {
        description: '402 X402_PAYMENT_REQUIRED',
        ErrorClass: LinkupPaymentRequiredError,
        expectedMessage: 'Payment required',
        input: {
          error: { code: 'X402_PAYMENT_REQUIRED', details: [], message: 'Payment required' },
          statusCode: 402,
        },
      },
      {
        description: '401',
        ErrorClass: LinkupAuthenticationError,
        expectedMessage: 'Unauthorized action',
        input: {
          error: { code: 'UNAUTHORIZED', details: [], message: 'Unauthorized action' },
          statusCode: 401,
        },
      },
      {
        description: '403',
        ErrorClass: LinkupAuthenticationError,
        expectedMessage: 'Forbidden action',
        input: {
          error: { code: 'FORBIDDEN', details: [], message: 'Forbidden action' },
          statusCode: 403,
        },
      },
      {
        description: '404 TASK_NOT_FOUND',
        ErrorClass: LinkupTaskNotFoundError,
        expectedMessage: 'Task task-123 not found.',
        input: {
          error: { code: 'TASK_NOT_FOUND', details: [], message: 'Task task-123 not found.' },
          statusCode: 404,
        },
      },
      {
        description: '429 INSUFFICIENT_FUNDS_CREDITS',
        ErrorClass: LinkupInsufficientCreditError,
        expectedMessage: 'You do not have enough credits to perform this request.',
        input: {
          error: {
            code: 'INSUFFICIENT_FUNDS_CREDITS',
            details: [],
            message: 'You do not have enough credits to perform this request.',
          },
          statusCode: 429,
        },
      },
      {
        description: '429 EXCEED_BUDGET_LIMIT',
        ErrorClass: LinkupBudgetLimitExceededError,
        expectedMessage: 'The API key has reached its budget limit.',
        input: {
          error: {
            code: 'EXCEED_BUDGET_LIMIT',
            details: [],
            message: 'The API key has reached its budget limit.',
          },
          statusCode: 429,
        },
      },
      {
        description: '429 TASKS_QUEUE_LIMIT_EXCEEDED',
        ErrorClass: LinkupTasksQueueLimitExceededError,
        expectedMessage:
          'Too many pending tasks. You have 0 slots available (max 100). Please wait for some tasks to complete before submitting new ones.',
        input: {
          error: {
            code: 'TASKS_QUEUE_LIMIT_EXCEEDED',
            details: [],
            message:
              'Too many pending tasks. You have 0 slots available (max 100). Please wait for some tasks to complete before submitting new ones.',
          },
          statusCode: 429,
        },
      },
      {
        description: '429 TOO_MANY_REQUESTS',
        ErrorClass: LinkupTooManyRequestsError,
        expectedMessage: 'Too many requests',
        input: {
          error: { code: 'TOO_MANY_REQUESTS', details: [], message: 'Too many requests' },
          statusCode: 429,
        },
      },
      {
        description: '429 unknown code',
        ErrorClass: LinkupUnknownError,
        expectedMessage: 'An unknown error occurred: foobar',
        input: {
          error: { code: 'FOOBAR', details: [], message: 'foobar' },
          statusCode: 429,
        },
      },
      {
        description: '500',
        ErrorClass: LinkupUnknownError,
        expectedMessage: 'An unknown error occurred: Internal server error',
        input: {
          error: { code: 'INTERNAL_SERVER_ERROR', details: [], message: 'Internal server error' },
          statusCode: 500,
        },
      },
    ])('should throw the correct error on $description', async ({
      input,
      ErrorClass,
      expectedMessage,
    }) => {
      mockAxiosInstance.post.mockRejectedValueOnce(refineError(input));
      const error = await underTest.search({} as SearchParams).catch(e => e);
      expect(error).toBeInstanceOf(ErrorClass);
      expect(error.message).toEqual(expectedMessage);
    });

    it('should handle malformed error responses without error property', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing malformed response
      mockAxiosInstance.post.mockRejectedValueOnce(refineError({ statusCode: 500 } as any));
      const error = await underTest.search({} as SearchParams).catch(e => e);
      expect(error).toBeInstanceOf(LinkupUnknownError);
      expect(error.message).toContain('An unknown error occurred');
    });
  });

  describe('x402 mode', () => {
    const mockSigner: X402Signer = {
      createPaymentPayload: jest.fn().mockResolvedValue({ signed: true }),
    };

    const { decodePaymentRequiredHeader, encodePaymentSignatureHeader } =
      // biome-ignore lint/suspicious/noExplicitAny: testing purpose
      jest.requireMock('@x402/core/http') as any;

    const createX402Client = () => {
      maxios.create = jest.fn(() => mockAxiosInstance);
      mockAxiosInstance.interceptors.response.use.mockClear();
      mockAxiosInstance.request.mockClear();
      (mockSigner.createPaymentPayload as jest.Mock).mockClear();
      (decodePaymentRequiredHeader as jest.Mock).mockClear();
      (encodePaymentSignatureHeader as jest.Mock).mockClear();
      return new LinkupClient({ signer: mockSigner });
    };

    const getX402ErrorHandler = () => {
      // The first call to interceptors.response.use is from setupX402Interceptor
      return mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
    };

    it('should not set Authorization header in x402 mode', () => {
      createX402Client();

      expect(maxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.linkup.so/v1',
        headers: {
          'User-Agent': expect.stringContaining('Linkup-JS-SDK/'),
        },
      });
    });

    it('should register two response interceptors in x402 mode', () => {
      createX402Client();

      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(2);
    });

    it('should handle 402 → sign → retry → success', async () => {
      createX402Client();
      const x402ErrorHandler = getX402ErrorHandler();

      const error402 = {
        config: {
          headers: { 'User-Agent': 'Linkup-JS-SDK/0.0.0' },
          method: 'post',
          url: '/search',
        },
        response: {
          headers: { 'payment-required': 'encoded-payment-data' },
          status: 402,
        },
      };

      const successResponse = { data: { answer: 'ok' } };
      mockAxiosInstance.request.mockResolvedValueOnce(successResponse);

      const result = await x402ErrorHandler(error402);

      expect(decodePaymentRequiredHeader).toHaveBeenCalledWith('encoded-payment-data');
      expect(mockSigner.createPaymentPayload).toHaveBeenCalledWith({
        decoded: 'encoded-payment-data',
      });
      expect(encodePaymentSignatureHeader).toHaveBeenCalledWith({ signed: true });
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          _x402Retried: true,
          headers: expect.objectContaining({
            'payment-signature': 'signed-payment',
          }),
        }),
      );
      expect(result).toEqual(successResponse);
    });

    it('should reject with retry error when retried request fails', async () => {
      createX402Client();
      const x402ErrorHandler = getX402ErrorHandler();

      const error402 = {
        config: {
          headers: {},
          method: 'post',
          url: '/search',
        },
        response: {
          headers: { 'payment-required': 'encoded-payment-data' },
          status: 402,
        },
      };

      const retryError = new Error('retry failed');
      mockAxiosInstance.request.mockRejectedValueOnce(retryError);

      await expect(x402ErrorHandler(error402)).rejects.toBe(retryError);
    });

    it('should throw LinkupPaymentRequiredError when payment-required header is missing', async () => {
      createX402Client();
      const x402ErrorHandler = getX402ErrorHandler();

      const error402NoHeader = {
        config: {
          headers: {},
        },
        response: {
          headers: {},
          status: 402,
        },
      };

      await expect(x402ErrorHandler(error402NoHeader)).rejects.toBeInstanceOf(
        LinkupPaymentRequiredError,
      );
      expect(decodePaymentRequiredHeader).not.toHaveBeenCalled();
    });

    it('should not retry when _x402Retried is already true', async () => {
      createX402Client();
      const x402ErrorHandler = getX402ErrorHandler();

      const retriedError = {
        config: {
          _x402Retried: true,
          headers: {},
        },
        response: {
          headers: { 'payment-required': 'encoded-payment-data' },
          status: 402,
        },
      };

      await expect(x402ErrorHandler(retriedError)).rejects.toBe(retriedError);
      expect(mockAxiosInstance.request).not.toHaveBeenCalled();
    });

    it('should pass through non-402 errors', async () => {
      createX402Client();
      const x402ErrorHandler = getX402ErrorHandler();

      const error500 = {
        config: {
          headers: {},
        },
        response: {
          status: 500,
        },
      };

      await expect(x402ErrorHandler(error500)).rejects.toBe(error500);
      expect(mockAxiosInstance.request).not.toHaveBeenCalled();
      expect(decodePaymentRequiredHeader).not.toHaveBeenCalled();
    });

    it('should pass through errors without response (network error)', async () => {
      createX402Client();
      const x402ErrorHandler = getX402ErrorHandler();

      const networkError = { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' };

      await expect(x402ErrorHandler(networkError)).rejects.toBe(networkError);
      expect(mockAxiosInstance.request).not.toHaveBeenCalled();
      expect(decodePaymentRequiredHeader).not.toHaveBeenCalled();
    });
  });
});
