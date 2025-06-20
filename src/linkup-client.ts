import axios from 'axios';
import {
  LinkupAuthenticationError,
  LinkupError,
  LinkupInsufficientCreditError,
  LinkupInvalidRequestError,
  LinkupNoResultError,
  LinkupTooManyRequestsError,
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

export class LinkupClient {
  private readonly USER_AGENT = 'Linkup-JS-SDK/1.0.8';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly endpoint: string;

  constructor(config: ApiConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.linkup.so/v1';
    this.endpoint = config.endpoint || '/search';
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
    let headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (typeof window === 'undefined') {
      headers['User-Agent'] = this.USER_AGENT;
    }

    return axios
      .post(this.endpoint, this.sanitizeParams(params), {
        baseURL: this.baseUrl,
        headers,
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
    includeImages,
    structuredOutputSchema,
    includeDomains,
    excludeDomains,
    fromDate,
    toDate,
  }: SearchParams<T>): Record<string, string | boolean | string[]> {
    return {
      q: query,
      depth,
      outputType,
      ...(includeImages && { includeImages }),
      ...(includeDomains && { includeDomains }),
      ...(excludeDomains && { excludeDomains }),
      ...(fromDate && { fromDate: fromDate.toISOString() }),
      ...(toDate && { toDate: toDate.toISOString() }),
      ...(structuredOutputSchema && {
        structuredOutputSchema: JSON.stringify(
          isZodObject(structuredOutputSchema)
            ? zodToJsonSchema(structuredOutputSchema as ZodObject<ZodRawShape>)
            : structuredOutputSchema,
        ),
      }),
    };
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
        switch (code) {
          case 'INSUFFICIENT_FUNDS_CREDITS':
            return new LinkupInsufficientCreditError(message);
          case 'TOO_MANY_REQUESTS':
            return new LinkupTooManyRequestsError(message);
          default:
            return new LinkupUnknownError(
              `An unknown error occurred: ${error.message}`,
            );
        }
      default:
        return new LinkupUnknownError(
          `An unknown error occurred: ${error.message}`,
        );
    }
  }
}
