import { LinkupClient } from '../linkup-client';
import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import {
  ImageSearchResult,
  LinkupApiError,
  SearchParams,
  Source,
  TextSearchResult,
} from '../types';
import {
  LinkupAuthenticationError,
  LinkupInsufficientCreditError,
  LinkupInvalidRequestError,
  LinkupNoResultError,
  LinkupTooManyRequestsError,
  LinkupUnknownError,
} from '../errors';
import { z } from 'zod';
import { join } from 'path';
import { readFileSync } from 'fs';

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
      query: 'foo',
      depth: 'deep',
      outputType: 'sourcedAnswer',
    });

    expect(maxios.post).toHaveBeenCalledWith(
      '/search',
      {
        q: 'foo',
        depth: 'deep',
        outputType: 'sourcedAnswer',
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
      query: 'foo',
      depth: 'deep',
      outputType: 'sourcedAnswer',
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
            url: 'http://foo.bar/baz',
            snippet: 'foo bar baz',
          },
          {
            type: 'text',
            name: 'bar',
            url: 'http://foo.bar/baz',
            content: 'foo bar baz',
          },
          {
            type: 'image',
            name: 'baz',
            url: 'http://foo.bar/baz',
          },
        ],
      },
    } as AxiosResponse);

    const result = await underTest.search({
      query: 'foo',
      depth: 'standard',
      outputType: 'sourcedAnswer',
    });

    expect(result.answer).toEqual('foo');
    expect((result.sources.at(0) as Source)?.name).toEqual('foo');
    expect((result.sources.at(0) as Source)?.url).toEqual('http://foo.bar/baz');
    expect((result.sources.at(0) as Source)?.snippet).toEqual('foo bar baz');
    expect((result.sources.at(1) as TextSearchResult)?.type).toEqual('text');
    expect((result.sources.at(1) as TextSearchResult)?.name).toEqual('bar');
    expect((result.sources.at(1) as TextSearchResult)?.url).toEqual(
      'http://foo.bar/baz',
    );
    expect((result.sources.at(1) as TextSearchResult)?.content).toEqual(
      'foo bar baz',
    );
    expect((result.sources.at(2) as ImageSearchResult)?.type).toEqual('image');
    expect((result.sources.at(2) as ImageSearchResult)?.name).toEqual('baz');
    expect((result.sources.at(2) as ImageSearchResult)?.url).toEqual(
      'http://foo.bar/baz',
    );
  });

  it('should handle searchResults output type', async () => {
    maxios.post.mockResolvedValueOnce({
      data: { results: [] },
    } as AxiosResponse);

    const result = await underTest.search({
      query: 'foo',
      depth: 'standard',
      outputType: 'searchResults',
    });

    expect(result).toHaveProperty('results');
  });

  it('should handle structured output type using JSON schema', async () => {
    maxios.post.mockResolvedValueOnce({
      data: 'foo',
    } as AxiosResponse);

    const result = await underTest.search({
      query: 'foo',
      depth: 'standard',
      outputType: 'structured',
      structuredOutputSchema: { type: 'string' },
    });

    expect(result).toEqual('foo');
  });

  it('should handle structured output type using Zod schema', async () => {
    maxios.post.mockResolvedValueOnce({
      data: 'foo',
    } as AxiosResponse);

    await underTest.search({
      query: 'foo',
      depth: 'standard',
      outputType: 'structured',
      structuredOutputSchema: z.object({ foo: z.string() }),
    });

    expect(maxios.post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        q: 'foo',
        structuredOutputSchema: expect.stringContaining(
          '"foo":{"type":"string"}',
        ),
      }),
      expect.anything(),
    );
  });

  it('should refine errors', async () => {
    // 400 invalid
    let invalidError: LinkupApiError = {
      statusCode: 400,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [
          {
            field: 'outputType',
            message:
              'outputType must be one of the following values: sourcedAnswer, searchResults, structured',
          },
        ],
      },
    };
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

    await expect(
      underTest.search({} as SearchParams<'sourcedAnswer'>),
    ).rejects.toThrow(
      new LinkupInvalidRequestError(
        'Validation failed outputType must be one of the following values: sourcedAnswer, searchResults, structured',
      ),
    );

    // 400 empty result
    invalidError = {
      statusCode: 400,
      error: {
        code: 'SEARCH_QUERY_NO_RESULT',
        message: 'The query did not yield any result',
        details: [],
      },
    };
    maxios.isAxiosError.mockReturnValueOnce(true);
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

    await expect(
      underTest.search({} as SearchParams<'sourcedAnswer'>),
    ).rejects.toThrow(new LinkupNoResultError(invalidError.error.message));

    // 401
    invalidError = {
      statusCode: 401,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized action',
        details: [],
      },
    };
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

    await expect(
      underTest.search({} as SearchParams<'sourcedAnswer'>),
    ).rejects.toThrow(
      new LinkupAuthenticationError(invalidError.error.message),
    );

    // 403
    invalidError = {
      statusCode: 403,
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden action',
        details: [],
      },
    };
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

    await expect(
      underTest.search({} as SearchParams<'sourcedAnswer'>),
    ).rejects.toThrow(
      new LinkupAuthenticationError(invalidError.error.message),
    );

    // 429 - Insufficient credits
    invalidError = {
      statusCode: 429,
      error: {
        code: 'INSUFFICIENT_FUNDS_CREDITS',
        message: 'You do not have enough credits to perform this request.',
        details: [],
      },
    };
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

    await expect(
      underTest.search({} as SearchParams<'sourcedAnswer'>),
    ).rejects.toThrow(
      new LinkupInsufficientCreditError(invalidError.error.message),
    );

    // 429 - Too many requests
    invalidError = {
      statusCode: 429,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests',
        details: [],
      },
    };
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

    await expect(
      underTest.search({} as SearchParams<'sourcedAnswer'>),
    ).rejects.toThrow(
      new LinkupTooManyRequestsError(invalidError.error.message),
    );

    // 429 - Other
    invalidError = {
      statusCode: 429,
      error: {
        code: 'FOOBAR',
        message: 'foobar',
        details: [],
      },
    };
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

    await expect(
      underTest.search({} as SearchParams<'sourcedAnswer'>),
    ).rejects.toThrow(
      new LinkupUnknownError(
        `An unknown error occurred: ${invalidError.error.message}`,
      ),
    );

    // 500
    invalidError = {
      statusCode: 500,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        details: [],
      },
    };
    maxios.post.mockRejectedValueOnce(generateAxiosError(invalidError));

    await expect(
      underTest.search({} as SearchParams<'sourcedAnswer'>),
    ).rejects.toThrow(
      new LinkupUnknownError(
        `An unknown error occurred: ${invalidError.error.message}`,
      ),
    );
  });
});

const generateAxiosError = (e: LinkupApiError): AxiosError => {
  return {
    isAxiosError: true,
    name: e.error.code,
    message: e.error.message,
    response: {
      data: e,
      status: e.statusCode,
      statusText: e.error.message,
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    },
    config: {} as InternalAxiosRequestConfig,
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
