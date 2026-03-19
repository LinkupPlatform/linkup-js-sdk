import axios, { AxiosInstance } from 'axios';
import { ZodObject, ZodRawShape } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { version } from '../package.json';
import { LinkupPaymentRequiredError } from './errors';
import {
  ApiConfig,
  FetchParams,
  LinkupFetchResponse,
  LinkupSearchResponse,
  SearchParams,
} from './types';
import { refineError } from './utils/refine-error.utils';
import { isZodObject } from './utils/schema.utils';
import type { X402Signer } from './x402/types';

export class LinkupClient {
  private readonly USER_AGENT = `Linkup-JS-SDK/${version}`;
  private readonly client: AxiosInstance;

  constructor(config: ApiConfig) {
    const baseURL = config.baseUrl || 'https://api.linkup.so/v1';
    const headers = {
      'User-Agent': this.USER_AGENT,
      ...('apiKey' in config ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    };

    this.client = axios.create({ baseURL, headers });

    if ('signer' in config) {
      this.setupX402Interceptor(config.signer);
    }

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
    return this.client.post('/search', this.sanitizeParams(params)).then(response => response.data);
  }

  async fetch<T extends FetchParams>(params: T): Promise<LinkupFetchResponse<T>> {
    return this.client.post('/fetch', params).then(response => response.data);
  }

  private setupX402Interceptor(signer: X402Signer): void {
    this.client.interceptors.response.use(
      response => response,
      async error => {
        if (!error.response || error.response.status !== 402 || error.config?._x402Retried) {
          return Promise.reject(error);
        }

        const paymentRequiredHeader = error.response.headers['payment-required'];

        if (!paymentRequiredHeader) {
          return Promise.reject(
            new LinkupPaymentRequiredError('Received 402 but no payment-required header'),
          );
        }

        try {
          const { decodePaymentRequiredHeader, encodePaymentSignatureHeader } = await import(
            '@x402/core/http'
          );

          const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader);
          const paymentPayload = await signer.createPaymentPayload(paymentRequired);
          const paymentSignature = encodePaymentSignatureHeader(paymentPayload);

          const originalRequest = error.config;
          originalRequest.headers['payment-signature'] = paymentSignature;
          originalRequest._x402Retried = true;

          return this.client.request(originalRequest);
        } catch (error) {
          return Promise.reject(
            new LinkupPaymentRequiredError(
              `X402 payment failed: ${error instanceof Error ? error.message : error}`,
            ),
          );
        }
      },
    );
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
}
