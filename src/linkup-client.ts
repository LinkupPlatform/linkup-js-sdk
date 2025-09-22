import axios, { AxiosInstance } from 'axios';
import { ZodObject, ZodRawShape } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import {
  ApiConfig,
  FetchParams,
  LinkupFetchResponse,
  SearchParams,
  SearchResults,
  SearchResultsParams,
  SourcedAnswer,
  SourcedAnswerParams,
  Structured,
  StructuredParams,
  StructuredWithSources,
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

  async search(params: SourcedAnswerParams): Promise<SourcedAnswer>;
  async search(params: SearchResultsParams): Promise<SearchResults>;
  async search(params: StructuredParams & { includeSources: true }): Promise<StructuredWithSources>;
  async search(
    params: StructuredParams & { includeSources?: false | undefined },
  ): Promise<Structured>;

  async search(
    params: SearchParams,
  ): Promise<SourcedAnswer | SearchResults | Structured | StructuredWithSources> {
    return this.client.post('/search', this.sanitizeParams(params)).then(response => response.data);
  }

  async fetch<T extends FetchParams>(params: T): Promise<LinkupFetchResponse<T>> {
    return this.client.post('/fetch', params).then(response => response.data);
  }

  private sanitizeParams(params: SearchParams): Record<string, string | boolean | string[]> {
    const {
      query,
      depth,
      outputType,
      includeImages,
      includeDomains,
      excludeDomains,
      fromDate,
      toDate,
    } = params;

    const result: Record<string, string | boolean | string[]> = {
      depth,
      outputType,
      q: query,
      ...(includeImages && { includeImages }),
      ...(includeDomains && { includeDomains }),
      ...(excludeDomains && { excludeDomains }),
      ...(fromDate && { fromDate: fromDate.toISOString() }),
      ...(toDate && { toDate: toDate.toISOString() }),
    };

    if ('includeInlineCitations' in params && params.includeInlineCitations) {
      result.includeInlineCitations = params.includeInlineCitations;
    }

    if ('includeSources' in params && params.includeSources) {
      result.includeSources = params.includeSources;
    }

    if ('structuredOutputSchema' in params) {
      result.structuredOutputSchema = JSON.stringify(
        isZodObject(params.structuredOutputSchema)
          ? zodToJsonSchema(params.structuredOutputSchema as ZodObject<ZodRawShape>)
          : params.structuredOutputSchema,
      );
    }

    return result;
  }
}
