import { LinkupClient } from '../linkup-client';
import axios, { AxiosResponse } from 'axios';
import { SearchParams } from '../types';
import {
  LinkupAuthenticationError,
  LinkupInsufficientCreditError,
  LinkupInvalidRequestError,
  LinkupNoResultError,
  LinkupUnknownError,
} from '../errors';

jest.mock('axios');
const maxios = axios as jest.Mocked<typeof axios>;

describe('LinkupClient', () => {
  const underTest = new LinkupClient({ apiKey: '1234' });

  it('should make a successful API call with correct parameters', async () => {
    maxios.post.mockResolvedValueOnce({
      data: { answer: '' },
    } as AxiosResponse);
    await underTest.search({
      query: 'foo',
      depth: 'deep',
      outputType: 'sourcedAnswer',
    } as SearchParams);
    expect(maxios.post).toHaveBeenCalledWith(
      '/search',
      {
        q: 'foo',
        depth: 'deep',
        includeImages: false,
        outputType: 'sourcedAnswer',
      },
      {
        baseURL: 'https://api.linkup.so/v1',
        headers: {
          Authorization: 'Bearer 1234',
          'User-Agent': 'Linkup-JS-SDK/1.0.0',
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
      '/search',
      {
        q: 'foo',
        depth: 'deep',
        includeImages: false,
        outputType: 'sourcedAnswer',
      },
      {
        baseURL: 'http://foo.bar/baz',
        headers: {
          Authorization: 'Bearer 1234',
          'User-Agent': 'Linkup-JS-SDK/1.0.0',
        },
      },
    );
  });

  it('should handle sourcedAnswer output type', async () => {
    maxios.post.mockResolvedValueOnce({
      data: { answer: 'foo', sources: [] },
    } as AxiosResponse);

    const result = await underTest.search({
      query: 'foo',
      depth: 'standard',
      outputType: 'sourcedAnswer',
    });

    expect(result.answer).toEqual('foo');
    expect(result).toHaveProperty('sources');
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

  it('should handle structured output type', async () => {
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

  it('should refine errors', async () => {
    // Non Axios error
    maxios.post.mockRejectedValueOnce(new Error('unknown'));
    await underTest
      .search({} as SearchParams)
      .catch((e) => expect(e).toBeInstanceOf(LinkupUnknownError));

    // 400 invalid
    maxios.isAxiosError.mockReturnValueOnce(true);
    maxios.post.mockRejectedValueOnce({
      response: { status: 400, data: { message: '' } },
    });
    await underTest
      .search({} as SearchParams)
      .catch((e) => expect(e).toBeInstanceOf(LinkupInvalidRequestError));

    // 400 empty result
    maxios.isAxiosError.mockReturnValueOnce(true);
    maxios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { message: 'The query did not yield any result' },
      },
    });
    await underTest
      .search({} as SearchParams)
      .catch((e) => expect(e).toBeInstanceOf(LinkupNoResultError));

    // 403
    maxios.isAxiosError.mockReturnValueOnce(true);
    maxios.post.mockRejectedValueOnce({
      response: {
        status: 403,
        data: { message: '' },
      },
    });
    await underTest
      .search({} as SearchParams)
      .catch((e) => expect(e).toBeInstanceOf(LinkupAuthenticationError));

    // 429
    maxios.isAxiosError.mockReturnValueOnce(true);
    maxios.post.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { message: '' },
      },
    });
    await underTest
      .search({} as SearchParams)
      .catch((e) => expect(e).toBeInstanceOf(LinkupInsufficientCreditError));

    // 500
    maxios.isAxiosError.mockReturnValueOnce(true);
    maxios.post.mockRejectedValueOnce({
      response: {
        status: 500,
        data: { message: '' },
      },
    });
    await underTest
      .search({} as SearchParams)
      .catch((e) => expect(e).toBeInstanceOf(LinkupUnknownError));
  });

  it('should handle array error message', async () => {
    maxios.isAxiosError.mockReturnValueOnce(true);
    maxios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { message: ['foo', 'bar'] },
      },
    });
    await underTest
      .search({} as SearchParams)
      .catch((e) => expect(e).toBeInstanceOf(LinkupInvalidRequestError));
  });
});
