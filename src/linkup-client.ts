import axios, { AxiosInstance } from 'axios';
import { ZodObject, ZodRawShape } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import {
  ApiConfig,
  FetchParams,
  LinkupSearchResponse,
  SearchOutputType,
  SearchParams,
  SearchResults,
  SourcedAnswer,
  StructuredOutputSchema,
} from './types';
import { refineError } from './utils/refine-error.utils';
import { isZodObject } from './utils/schema.utils';

export class LinkupClient {
  private readonly USER_AGENT = 'Linkup-JS-SDK/2.0.0';
  private readonly client: AxiosInstance;

  constructor(config: ApiConfig) {
    const baseURL = config.baseUrl || 'https://api.linkup.so/v1';

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'User-Agent': this.USER_AGENT,
      },
    });

    this.client.interceptors.response.use(
      response => response,
      error => {
        if (!error.response || !error.response.data) {
          throw error;
        }
        throw refineError(error.response.data);
      },
    );
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
    return this.client
      .post('/search', this.sanitizeParams(params))
      .then(response => this.formatResponse<T>(response.data, params.outputType));
  }

  async fetch(params: FetchParams): Promise<unknown> {
    return this.client.post('/fetch', params).then(response => response.data);
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
      depth,
      outputType,
      q: query,
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
      // biome-ignore lint/complexity/noUselessSwitchCase: left for exhaustiveness
      case 'structured':
      default:
        return searchResponse as LinkupSearchResponse<T>;
    }
  }
}
