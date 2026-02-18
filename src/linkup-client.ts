import axios, { AxiosInstance } from 'axios';
import OpenAI from 'openai';
import { ZodObject, ZodRawShape } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { version } from '../package.json';
import { OpenAILinkupWrapper } from './openai-wrapper';
import {
  ApiConfig,
  FetchParams,
  LinkupFetchResponse,
  LinkupSearchResponse,
  SearchParams,
} from './types';
import { refineError } from './utils/refine-error.utils';
import { isZodObject } from './utils/schema.utils';

export class LinkupClient {
  private readonly USER_AGENT = `Linkup-JS-SDK/${version}`;
  private readonly USER_AGENT_WRAPPER = `Linkup-JS-SDK-wrapper/${version}`;
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

  async search<T extends SearchParams>(params: T): Promise<LinkupSearchResponse<T>> {
    return this.searchWithUserAgent(params);
  }

  private async searchWithUserAgent<T extends SearchParams>(
    params: T,
    userAgent?: string,
  ): Promise<LinkupSearchResponse<T>> {
    return this.client
      .post('/search', this.sanitizeParams(params), {
        ...(userAgent && { headers: { 'User-Agent': userAgent } }),
      })
      .then(response => response.data);
  }

  async fetch<T extends FetchParams>(params: T): Promise<LinkupFetchResponse<T>> {
    return this.client.post('/fetch', params).then(response => response.data);
  }

  private sanitizeParams<T extends SearchParams>(
    params: T,
  ): Record<string, string | boolean | string[] | number> {
    const {
      query,
      depth,
      outputType,
      includeImages,
      includeDomains,
      excludeDomains,
      fromDate,
      toDate,
      maxResults,
    } = params;

    const result: Record<string, string | boolean | string[] | number> = {
      depth,
      outputType,
      q: query,
      ...(includeImages && { includeImages }),
      ...(includeDomains && { includeDomains }),
      ...(excludeDomains && { excludeDomains }),
      ...(fromDate && { fromDate: fromDate.toISOString() }),
      ...(toDate && { toDate: toDate.toISOString() }),
      ...(maxResults && { maxResults }),
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

  wrap(openAIClient: OpenAI): OpenAILinkupWrapper {
    const wrappedSearch = (params: SearchParams & { outputType: 'searchResults' }) =>
      this.searchWithUserAgent(params, this.USER_AGENT_WRAPPER);
    return new OpenAILinkupWrapper(openAIClient, wrappedSearch);
  }
}
