import axios from 'axios';
import {
  LinkupAuthenticationError,
  LinkupError,
  LinkupInsufficientCreditError,
  LinkupInvalidRequestError,
  LinkupNoResultError,
  LinkupUnknownError,
} from './errors';
import {
  ApiConfig,
  SearchOutputType,
  SearchParams,
  SearchResults,
  SourcedAnswer,
  StructuredOutputSchema,
  LinkupSearchResponse,
  LinkupApiError,
} from './types';
import zodToJsonSchema from 'zod-to-json-schema';
import { ZodObject, ZodRawShape } from 'zod';
import { isZodObject, concatErrorAndDetails } from './utils';
import { linkupUserAgent } from '.';

export class LinkupClient {
  private readonly USER_AGENT = linkupUserAgent;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: ApiConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.linkup.so/v1';
  }

  async search<T extends 'sourcedAnswer' | 'searchResults' | 'structured'>(
    params: SearchParams<T>,
  ): Promise<
    T extends 'sourcedAnswer'
      ? SourcedAnswer
      : T extends 'searchResults'
        ? SearchResults
        : T extends 'structured'
          ? StructuredOutputSchema
          : never
  > {
    return axios
      .post('/search', this.sanitizeParams(params), {
        baseURL: this.baseUrl,
        headers: {
          'User-Agent': this.USER_AGENT,
          Authorization: `Bearer ${this.apiKey}`,
        },
      })
      .then((response) =>
        this.formatResponse<T>(response.data, params.outputType),
      )
      .catch((e) => {
        throw this.refineError(e.response.data);
      });
  }

  private sanitizeParams<T extends SearchOutputType>({
    query,
    depth,
    outputType,
    includeImages = false,
    structuredOutputSchema,
  }: SearchParams<T>): Record<string, string | boolean> {
    const searchParams: Record<string, string | boolean> = {
      q: query,
      depth,
      outputType,
      includeImages,
    };

    if (structuredOutputSchema) {
      searchParams.structuredOutputSchema = JSON.stringify(
        isZodObject(structuredOutputSchema)
          ? zodToJsonSchema(structuredOutputSchema as ZodObject<ZodRawShape>)
          : structuredOutputSchema,
      );
    }

    return searchParams;
  }

  private formatResponse<T>(
    searchResponse: unknown,
    outputType: SearchOutputType,
  ): LinkupSearchResponse<T> {
    switch (outputType) {
      case 'sourcedAnswer':
        return {
          answer: (searchResponse as SourcedAnswer).answer,
          sources: (searchResponse as SourcedAnswer).sources,
        } as LinkupSearchResponse<T>;
      case 'searchResults':
        return {
          results: (searchResponse as SearchResults).results,
        } as LinkupSearchResponse<T>;
      case 'structured':
      default:
        return searchResponse as LinkupSearchResponse<T>;
    }
  }

  private refineError(e: LinkupApiError): LinkupError {
    const { statusCode, error } = e;
    const { code, message } = error;

    switch (statusCode) {
      case 400:
        if (code === 'SEARCH_QUERY_NO_RESULT') {
          return new LinkupNoResultError(message);
        }
        return new LinkupInvalidRequestError(concatErrorAndDetails(e));
      case 401:
      case 403:
        return new LinkupAuthenticationError(message);
      case 429:
        return new LinkupInsufficientCreditError(message);
      default:
        return new LinkupUnknownError(
          `An unknown error occurred: ${error.message}`,
        );
    }
  }
}
