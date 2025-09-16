import axios, { AxiosInstance } from 'axios';
import { ZodObject, ZodRawShape } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import {
  ApiConfig,
  FetchParams,
  LinkupFetchResponse,
  LinkupSearchResponse,
  SearchOutputType,
  SearchParams,
  SearchResults,
  SourcedAnswer,
} from './types';
import { refineError } from './utils/refine-error.utils';
import { isZodObject } from './utils/schema.utils';

export class LinkupClient {
  private readonly USER_AGENT = 'Linkup-JS-SDK/2.1.1';
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

  async search<T extends SearchOutputType>(
    params: SearchParams<T>,
  ): Promise<LinkupSearchResponse<T>> {
    return this.client
      .post('/search', this.sanitizeParams(params))
      .then(response => this.formatResponse(response.data, params.outputType));
  }

  async fetch<T extends FetchParams>(params: T): Promise<LinkupFetchResponse<T>> {
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
    includeInlineCitations,
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
      ...(includeInlineCitations && { includeInlineCitations }),
      ...(structuredOutputSchema && {
        structuredOutputSchema: JSON.stringify(
          isZodObject(structuredOutputSchema)
            ? zodToJsonSchema(structuredOutputSchema as ZodObject<ZodRawShape>)
            : structuredOutputSchema,
        ),
      }),
    };
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
      // biome-ignore lint/complexity/noUselessSwitchCase: left for exhaustiveness
      case 'structured':
      default:
        return searchResponse as LinkupSearchResponse<T>;
    }
  }
}
