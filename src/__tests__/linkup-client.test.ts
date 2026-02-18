import axios, { type AxiosResponse } from 'axios';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  LinkupAuthenticationError,
  LinkupFetchError,
  LinkupInsufficientCreditError,
  LinkupInvalidRequestError,
  LinkupNoResultError,
  LinkupTooManyRequestsError,
  LinkupUnknownError,
} from '../errors';
import { LinkupClient } from '../linkup-client';
import { OpenAILinkupWrapper } from '../openai-wrapper';
import type {
  ImageSearchResult,
  LinkupApiError,
  SearchParams,
  Source,
  TextSearchResult,
} from '../types';
import { refineError } from '../utils/refine-error.utils';

jest.mock('axios');
const maxios = axios as jest.Mocked<typeof axios>;

type MockAxiosInstance = {
  interceptors: {
    response: {
      use: jest.Mock;
    };
  };
  post: jest.Mock;
};

const mockAxiosInstance: MockAxiosInstance = {
  interceptors: {
    response: {
      use: jest.fn(),
    },
  },
  post: jest.fn(),
};

maxios.create = jest.fn(() => mockAxiosInstance as unknown as import('axios').AxiosInstance);

describe('LinkupClient', () => {
  const underTest = new LinkupClient({ apiKey: '1234' });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance.post.mockClear();
  });

  it('should make a successful API call with correct parameters', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { answer: '' },
    } as AxiosResponse);

    await underTest.search({
      depth: 'deep',
      outputType: 'sourcedAnswer',
      query: 'foo',
    });

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/search',
      {
        depth: 'deep',
        outputType: 'sourcedAnswer',
        q: 'foo',
      },
      expect.any(Object),
    );
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

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/search',
      {
        depth: 'deep',
        excludeDomains: ['baz.com', 'qux.com'],
        fromDate: fromDate.toISOString(),
        includeDomains: ['foo.com', 'bar.com'],
        includeImages: true,
        includeInlineCitations: true,
        maxResults: 10,
        outputType: 'sourcedAnswer',
        q: 'foo',
        toDate: toDate.toISOString(),
      },
      expect.any(Object),
    );
  });

  it('should use custom base URL if provided', async () => {
    const customMockInstance: MockAxiosInstance = {
      interceptors: {
        response: {
          use: jest.fn(),
        },
      },
      post: jest.fn(),
    };

    maxios.create = jest.fn(() => customMockInstance as unknown as import('axios').AxiosInstance);

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
            content: 'foo bar baz',
            favicon: 'http://foo.bar/favicon.ico',
            name: 'bar',
            type: 'text',
            url: 'http://foo.bar/baz',
          },
          {
            name: 'baz',
            type: 'image',
            url: 'http://foo.bar/baz',
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
    expect((result.sources.at(1) as TextSearchResult)?.type).toEqual('text');
    expect((result.sources.at(1) as TextSearchResult)?.name).toEqual('bar');
    expect((result.sources.at(1) as TextSearchResult)?.url).toEqual('http://foo.bar/baz');
    expect((result.sources.at(1) as TextSearchResult)?.content).toEqual('foo bar baz');
    expect((result.sources.at(1) as TextSearchResult)?.favicon).toEqual(
      'http://foo.bar/favicon.ico',
    );
    expect((result.sources.at(2) as ImageSearchResult)?.type).toEqual('image');
    expect((result.sources.at(2) as ImageSearchResult)?.name).toEqual('baz');
    expect((result.sources.at(2) as ImageSearchResult)?.url).toEqual('http://foo.bar/baz');
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
      expect.any(Object),
    );
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

    it('should handle fetch errors', async () => {
      const fetchError: LinkupApiError = {
        error: {
          code: 'FETCH_ERROR',
          details: [],
          message: 'Failed to fetch the content from the URL',
        },
        statusCode: 400,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(refineError(fetchError));

      try {
        await underTest.fetch({
          url: 'https://invalid-url.com',
        });
        fail('Expected fetch to throw an error');
      } catch (e) {
        expect(e).toBeInstanceOf(LinkupFetchError);
        expect((e as LinkupFetchError).message).toEqual('Failed to fetch the content from the URL');
      }
    });
  });

  it('wrap returns a openAI wrapper instance', () => {
    const responsesCreate = jest.fn();
    const openAIClient = {
      chat: { completions: { create: jest.fn() } },
      responses: { create: responsesCreate },
    } as unknown as OpenAI;

    const wrapper = underTest.wrap(openAIClient);

    expect(wrapper).toBeInstanceOf(OpenAILinkupWrapper);
    expect(wrapper.responses).toBeDefined();
    expect(wrapper.chat).toBeDefined();
    expect(responsesCreate).not.toHaveBeenCalled();
  });

  it('wrap should return a openAI wrapper bound to the client search method', async () => {
    const responsesCreate = jest.fn();
    const openAIClient = {
      chat: { completions: { create: jest.fn() } },
      responses: { create: responsesCreate },
    } as unknown as OpenAI;
    const wrapper = underTest.wrap(openAIClient);

    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { results: [{ id: '1' }] },
    } as AxiosResponse);

    const firstResponse = {
      output: [
        {
          arguments: JSON.stringify({ query: 'foo-bar' }),
          name: 'search_web',
          type: 'function_call',
        },
      ],
    };
    const finalResponse = { final: true };
    responsesCreate.mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(finalResponse);

    const response = await wrapper.responses.create({ input: 'foo', model: 'model' });

    expect(response).toBe(finalResponse);
    // Verify the API was called with the search parameters
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/search',
      expect.objectContaining({
        depth: 'standard',
        outputType: 'searchResults',
        q: 'foo-bar',
      }),
      expect.any(Object),
    );
    expect(responsesCreate).toHaveBeenCalledTimes(2);
  });

  it('should refine errors', async () => {
    // 400 invalid
    let invalidError: LinkupApiError = {
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
    };
    mockAxiosInstance.post.mockRejectedValueOnce(refineError(invalidError));

    try {
      await underTest.search({} as SearchParams);
    } catch (e) {
      expect(e).toBeInstanceOf(LinkupInvalidRequestError);
      expect((e as LinkupInvalidRequestError).message).toEqual(
        'Validation failed outputType must be one of the following values: sourcedAnswer, searchResults, structured',
      );
    }

    // 400 empty result
    invalidError = {
      error: {
        code: 'SEARCH_QUERY_NO_RESULT',
        details: [],
        message: 'The query did not yield any result',
      },
      statusCode: 400,
    };
    mockAxiosInstance.post.mockRejectedValueOnce(refineError(invalidError));

    try {
      await underTest.search({} as SearchParams);
    } catch (e) {
      expect(e).toBeInstanceOf(LinkupNoResultError);
      expect((e as LinkupNoResultError).message).toEqual('The query did not yield any result');
    }

    // 401
    invalidError = {
      error: {
        code: 'UNAUTHORIZED',
        details: [],
        message: 'Unauthorized action',
      },
      statusCode: 401,
    };
    mockAxiosInstance.post.mockRejectedValueOnce(refineError(invalidError));

    try {
      await underTest.search({} as SearchParams);
    } catch (e) {
      expect(e).toBeInstanceOf(LinkupAuthenticationError);
      expect((e as LinkupAuthenticationError).message).toEqual('Unauthorized action');
    }

    // 403
    invalidError = {
      error: {
        code: 'FORBIDDEN',
        details: [],
        message: 'Forbidden action',
      },
      statusCode: 403,
    };
    mockAxiosInstance.post.mockRejectedValueOnce(refineError(invalidError));

    try {
      await underTest.search({} as SearchParams);
    } catch (e) {
      expect(e).toBeInstanceOf(LinkupAuthenticationError);
      expect((e as LinkupAuthenticationError).message).toEqual('Forbidden action');
    }

    // 429 - Insufficient credits
    invalidError = {
      error: {
        code: 'INSUFFICIENT_FUNDS_CREDITS',
        details: [],
        message: 'You do not have enough credits to perform this request.',
      },
      statusCode: 429,
    };
    mockAxiosInstance.post.mockRejectedValueOnce(refineError(invalidError));

    try {
      await underTest.search({} as SearchParams);
    } catch (e) {
      expect(e).toBeInstanceOf(LinkupInsufficientCreditError);
      expect((e as LinkupInsufficientCreditError).message).toEqual(
        'You do not have enough credits to perform this request.',
      );
    }

    // 429 - Too many requests
    invalidError = {
      error: {
        code: 'TOO_MANY_REQUESTS',
        details: [],
        message: 'Too many requests',
      },
      statusCode: 429,
    };
    mockAxiosInstance.post.mockRejectedValueOnce(refineError(invalidError));

    try {
      await underTest.search({} as SearchParams);
    } catch (e) {
      expect(e).toBeInstanceOf(LinkupTooManyRequestsError);
      expect((e as LinkupTooManyRequestsError).message).toEqual('Too many requests');
    }

    // 429 - Other
    invalidError = {
      error: {
        code: 'FOOBAR',
        details: [],
        message: 'foobar',
      },
      statusCode: 429,
    };
    mockAxiosInstance.post.mockRejectedValueOnce(refineError(invalidError));

    try {
      await underTest.search({} as SearchParams);
    } catch (e) {
      expect(e).toBeInstanceOf(LinkupUnknownError);
      expect((e as LinkupUnknownError).message).toEqual(
        `An unknown error occurred: ${invalidError.error.message}`,
      );
    }

    // 500
    invalidError = {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        details: [],
        message: 'Internal server error',
      },
      statusCode: 500,
    };
    mockAxiosInstance.post.mockRejectedValueOnce(refineError(invalidError));

    try {
      await underTest.search({} as SearchParams);
    } catch (e) {
      expect(e).toBeInstanceOf(LinkupUnknownError);
      expect((e as LinkupUnknownError).message).toEqual(
        `An unknown error occurred: ${invalidError.error.message}`,
      );
    }
  });

  it('should handle malformed error responses without error property', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing malformed response
    const malformedError = { statusCode: 500 } as any;
    mockAxiosInstance.post.mockRejectedValueOnce(refineError(malformedError));

    try {
      await underTest.search({} as SearchParams);
      fail('Expected search to throw an error');
    } catch (e) {
      expect(e).toBeInstanceOf(LinkupUnknownError);
      expect((e as LinkupUnknownError).message).toContain('An unknown error occurred');
    }
  });
});
