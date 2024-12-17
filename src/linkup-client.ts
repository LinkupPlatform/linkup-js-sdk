import axios, { AxiosError } from 'axios';
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
  LinkupSearchResponse,
  SearchOutputType,
  SearchParams,
  SearchResults,
  SourcedAnswer,
} from './types';
import { getVersionFromPackage } from './utils/version.utils';
import zodToJsonSchema from 'zod-to-json-schema';
import { ZodObject, ZodRawShape } from 'zod';
import { isZodObject } from './utils/schema.utils';

export class LinkupClient {
  private readonly USER_AGENT = `Linkup-JS-SDK/${getVersionFromPackage()}`;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: ApiConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.linkup.so/v1';
  }

  async search<T extends SearchOutputType>(
    params: SearchParams<T>,
  ): Promise<LinkupSearchResponse<T>> {
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
        throw this.refineError(e);
      });
  }

  private sanitizeParams({
    query,
    depth,
    outputType,
    includeImages = false,
    structuredOutputSchema,
  }: SearchParams): Record<string, string | boolean> {
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

  private formatResponse<T extends SearchOutputType>(
    searchResponse: unknown,
    outputType: T,
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

  private refineError(error: Error): LinkupError {
    const unknownErrorMessage = `An unknown error occurred: ${error.message}`;

    if (
      !axios.isAxiosError(error) ||
      !error.response ||
      !('message' in error.response.data)
    ) {
      return new LinkupUnknownError(unknownErrorMessage);
    }

    const {
      data: { message },
      status,
    } = (error as AxiosError<{ message: string }, unknown>).response!;

    switch (status) {
      case 400:
        if (message === 'The query did not yield any result') {
          return new LinkupNoResultError();
        }
        return new LinkupInvalidRequestError(
          Array.isArray(message) ? message.join(',') : message,
        );
      case 403:
        return new LinkupAuthenticationError();
      case 429:
        return new LinkupInsufficientCreditError();
      default:
        return new LinkupUnknownError(unknownErrorMessage);
    }
  }
}
