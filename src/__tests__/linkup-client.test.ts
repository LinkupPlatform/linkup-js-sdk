import axios, { type AxiosResponse } from 'axios';
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

const mockAxiosInstance = {
  interceptors: {
    response: {
      use: jest.fn(),
    },
  },
  post: jest.fn(),
  // biome-ignore lint/suspicious/noExplicitAny: testing purpose
} as any;

maxios.create = jest.fn(() => mockAxiosInstance);

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

    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/search', {
      depth: 'deep',
      outputType: 'sourcedAnswer',
      q: 'foo',
    });
  });

  it('should include includeInlineCitations parameter when provided', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { answer: '' },
    } as AxiosResponse);

    await underTest.search({
      depth: 'deep',
      includeInlineCitations: true,
      outputType: 'sourcedAnswer',
      query: 'foo',
    });

    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/search', {
      depth: 'deep',
      includeInlineCitations: true,
      outputType: 'sourcedAnswer',
      q: 'foo',
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
        'User-Agent': 'Linkup-JS-SDK/2.1.1',
      },
    });
  });

  it('should handle sourcedAnswer output type', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: {
        answer: 'foo',
        sources: [
          {
            name: 'foo',
            snippet: 'foo bar baz',
            url: 'http://foo.bar/baz',
          },
          {
            content: 'foo bar baz',
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
    expect((result.sources.at(1) as TextSearchResult)?.type).toEqual('text');
    expect((result.sources.at(1) as TextSearchResult)?.name).toEqual('bar');
    expect((result.sources.at(1) as TextSearchResult)?.url).toEqual('http://foo.bar/baz');
    expect((result.sources.at(1) as TextSearchResult)?.content).toEqual('foo bar baz');
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
      data: 'foo',
    } as AxiosResponse);

    const result = await underTest.search({
      depth: 'standard',
      outputType: 'structured',
      query: 'foo',
      structuredOutputSchema: { type: 'string' },
    });

    expect(result).toEqual('foo');
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
      await underTest.search({} as SearchParams<'sourcedAnswer'>);
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
      await underTest.search({} as SearchParams<'sourcedAnswer'>);
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
      await underTest.search({} as SearchParams<'sourcedAnswer'>);
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
      await underTest.search({} as SearchParams<'sourcedAnswer'>);
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
      await underTest.search({} as SearchParams<'sourcedAnswer'>);
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
      await underTest.search({} as SearchParams<'sourcedAnswer'>);
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
      await underTest.search({} as SearchParams<'sourcedAnswer'>);
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
      await underTest.search({} as SearchParams<'sourcedAnswer'>);
    } catch (e) {
      expect(e).toBeInstanceOf(LinkupUnknownError);
      expect((e as LinkupUnknownError).message).toEqual(
        `An unknown error occurred: ${invalidError.error.message}`,
      );
    }
  });
});
