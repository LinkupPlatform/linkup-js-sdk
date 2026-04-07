import axios, { type AxiosResponse } from 'axios';
import { z } from 'zod';
import {
  FetchUrlIsFileError,
  LinkupAuthenticationError,
  LinkupFetchError,
  LinkupFetchResponseTooLargeError,
  LinkupInsufficientCreditError,
  LinkupInvalidRequestError,
  LinkupNoResultError,
  LinkupPaymentRequiredError,
  LinkupSearchResourceExhaustedError,
  LinkupTooManyRequestsError,
  LinkupUnknownError,
} from '../errors';
import { LinkupClient } from '../linkup-client';
import type { ImageSearchResult, SearchParams, Source, TextSearchResult } from '../types';
import { refineError } from '../utils/refine-error.utils';
import type { X402Signer } from '../x402/types';

jest.mock('axios');

jest.mock('@x402/core/http', () => ({
  decodePaymentRequiredHeader: jest.fn((header: string) => ({ decoded: header })),
  encodePaymentSignatureHeader: jest.fn((_payload: unknown) => 'signed-payment'),
}));
const maxios = axios as jest.Mocked<typeof axios>;

const mockAxiosInstance = {
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
      fromDate: fromDate.toISOString(),
      includeDomains: ['foo.com', 'bar.com'],
      includeImages: true,
      includeInlineCitations: true,
      maxResults: 10,
      outputType: 'sourcedAnswer',
      q: 'foo',
      toDate: toDate.toISOString(),
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
        description: '400 FETCH_URL_IS_FILE',
        ErrorClass: FetchUrlIsFileError,
        expectedMessage: 'The URL points to a file',
        input: {
          error: { code: 'FETCH_URL_IS_FILE', details: [], message: 'The URL points to a file' },
          statusCode: 400,
        },
      },
      {
        description: '402 PAYMENT_REQUIRED',
        ErrorClass: LinkupPaymentRequiredError,
        expectedMessage: 'Payment required',
        input: {
          error: { code: 'PAYMENT_REQUIRED', details: [], message: 'Payment required' },
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
        description: '502 SEARCH_RESOURCE_EXHAUSTED',
        ErrorClass: LinkupSearchResourceExhaustedError,
        expectedMessage: 'Search resources exhausted',
        input: {
          error: {
            code: 'SEARCH_RESOURCE_EXHAUSTED',
            details: [],
            message: 'Search resources exhausted',
          },
          statusCode: 502,
        },
      },
      {
        description: '502 unknown code',
        ErrorClass: LinkupUnknownError,
        expectedMessage: 'An unknown error occurred: Bad gateway',
        input: {
          error: { code: 'SOME_OTHER_CODE', details: [], message: 'Bad gateway' },
          statusCode: 502,
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
    ])(
      'should throw the correct error on $description',
      async ({ input, ErrorClass, expectedMessage }) => {
        mockAxiosInstance.post.mockRejectedValueOnce(refineError(input));
        const error = await underTest.search({} as SearchParams).catch(e => e);
        expect(error).toBeInstanceOf(ErrorClass);
        expect(error.message).toEqual(expectedMessage);
      },
    );

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
