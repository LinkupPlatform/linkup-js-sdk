import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';
import {
  LinkupAuthenticationError,
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

jest.mock('axios');
const maxios = axios as jest.Mocked<typeof axios>;

describe('LinkupClient', () => {
  const underTest = new LinkupClient({ apiKey: '1234' });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should make a successful API call with correct parameters', async () => {
    maxios.post.mockResolvedValueOnce({
      data: { answer: '' },
    } as AxiosResponse);

    await underTest.search({
      depth: 'deep',
      outputType: 'sourcedAnswer',
      query: 'foo',
    });

    expect(maxios.post).toHaveBeenCalledWith(
      '/search',
      {
        depth: 'deep',
        outputType: 'sourcedAnswer',
        q: 'foo',
      },
      {
        baseURL: 'https://api.linkup.so/v1',
        headers: {
          Authorization: 'Bearer 1234',
          'User-Agent': `Linkup-JS-SDK/${getVersionFromPackage()}`,
        },
      },
    );
  });

  it('should use custom base URL if provided', async () => {
    const client = new LinkupClient({
      apiKey: '1234',
      baseUrl: 'http://foo.bar/baz',
    });

    maxios.post.mockResolvedValueOnce({
      data: { answer: '' },
    } as AxiosResponse);

    await client.search({
      depth: 'deep',
      outputType: 'sourcedAnswer',
      query: 'foo',
    });

    expect(maxios.post).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        baseURL: 'http://foo.bar/baz',
      }),
    );
  });

  it('should handle sourcedAnswer output type', async () => {
    maxios.post.mockResolvedValueOnce({
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
    maxios.post.mockResolvedValueOnce({
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
    maxios.post.mockResolvedValueOnce({
      data: {
        data: 'foo',
        sources: [
          {
            name: 'foo',
            snippet: 'foo bar baz',
            url: 'http://foo.bar/baz',
          },
        ],
      },
    } as AxiosResponse);

    const result = await underTest.search({
      depth: 'standard',
      outputType: 'structured',
      query: 'foo',
      structuredOutputSchema: { type: 'string' },
    });

    expect(result).toEqual({
      data: 'foo',
      sources: [{ name: 'foo', snippet: 'foo bar baz', url: 'http://foo.bar/baz' }],
    });
  });

  it('should handle structured output type using Zod schema', async () => {
    maxios.post.mockResolvedValueOnce({
      data: 'foo',
    } as AxiosResponse);

    await underTest.search({
      depth: 'standard',
      outputType: 'structured',
      query: 'foo',
      structuredOutputSchema: z.object({ foo: z.string() }),
    });

    expect(maxios.post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        q: 'foo',
        structuredOutputSchema: expect.stringContaining('"foo":{"type":"string"}'),
      }),
      expect.anything(),
    );
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
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

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
    maxios.isAxiosError.mockReturnValueOnce(true);
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

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
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

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
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

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
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

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
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

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
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

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
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

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

const generateAxiosError = (e: LinkupApiError): AxiosError => {
  return {
    config: {} as InternalAxiosRequestConfig,
    isAxiosError: true,
    message: e.error.message,
    name: e.error.code,
    response: {
      config: {} as InternalAxiosRequestConfig,
      data: e,
      headers: {},
      status: e.statusCode,
      statusText: e.error.message,
    },
    toJSON: () => ({}),
  };
};

const getVersionFromPackage = (): string => {
  try {
    const packagePath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch {
    throw new Error('Could not read package version');
  }
};
