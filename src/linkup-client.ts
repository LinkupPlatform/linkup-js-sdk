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
  ListResearchParams,
  ListTasksParams,
  PaginatedResearchTasks,
  PaginatedTasks,
  ResearchParams,
  ResearchTask,
  SearchParams,
  Task,
  TaskRequest,
} from './types';
import { refineError } from './utils/refine-error.utils';
import { isZodObject } from './utils/schema.utils';
import type { X402Signer } from './x402/types';

type SanitizedParams = Record<string, string | boolean | string[] | number>;
type QueryParamValue = string | number | boolean;
type QueryParams = Record<string, QueryParamValue | QueryParamValue[] | undefined>;

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
    return this.client
      .post('/search', this.sanitizeSearchParams(params))
      .then(response => response.data);
  }

  async fetch<T extends FetchParams>(params: T): Promise<LinkupFetchResponse<T>> {
    return this.client.post('/fetch', params).then(response => response.data);
  }

  async research(params: ResearchParams): Promise<ResearchTask> {
    return this.client
      .post('/research', this.sanitizeResearchParams(params))
      .then(response => this.normalizeResearchTask(response.data));
  }

  async listResearch(params: ListResearchParams = {}): Promise<PaginatedResearchTasks> {
    return this.client.get('/research', this.buildRequestConfig(params)).then(response => ({
      ...response.data,
      data: response.data.data.map((task: unknown) => this.normalizeResearchTask(task)),
    }));
  }

  async getResearch(id: string): Promise<ResearchTask> {
    return this.client
      .get(`/research/${id}`)
      .then(response => this.normalizeResearchTask(response.data));
  }

  async createTasks(tasks: TaskRequest[]): Promise<Task[]> {
    return this.client
      .post(
        '/tasks',
        tasks.map(task => this.sanitizeTaskRequest(task)),
      )
      .then(response => response.data.map((task: unknown) => this.normalizeTask(task)));
  }

  async listTasks(params: ListTasksParams = {}): Promise<PaginatedTasks> {
    return this.client.get('/tasks', this.buildRequestConfig(params)).then(response => ({
      ...response.data,
      data: response.data.data.map((task: unknown) => this.normalizeTask(task)),
    }));
  }

  async getTask(id: string): Promise<Task> {
    return this.client.get(`/tasks/${id}`).then(response => this.normalizeTask(response.data));
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

  private sanitizeSearchParams<T extends SearchParams>(params: T): SanitizedParams {
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

    const result: SanitizedParams = {
      depth,
      outputType,
      q: query,
      ...(includeImages && { includeImages }),
      ...(includeDomains && { includeDomains }),
      ...(excludeDomains && { excludeDomains }),
      ...(fromDate && { fromDate: this.serializeDate(fromDate) }),
      ...(toDate && { toDate: this.serializeDate(toDate) }),
      ...(maxResults && { maxResults }),
    };

    if ('includeInlineCitations' in params && params.includeInlineCitations) {
      result.includeInlineCitations = params.includeInlineCitations;
    }

    if ('includeSources' in params && params.includeSources) {
      result.includeSources = params.includeSources;
    }

    if ('structuredOutputSchema' in params) {
      result.structuredOutputSchema = this.serializeStructuredOutputSchema(
        params.structuredOutputSchema,
      );
    }

    return result;
  }

  private sanitizeResearchParams(params: ResearchParams): SanitizedParams {
    const {
      query,
      outputType,
      includeDomains,
      excludeDomains,
      fromDate,
      toDate,
      mode,
      reasoningDepth,
    } = params;

    const result: SanitizedParams = {
      outputType,
      q: query,
      ...(includeDomains && { includeDomains }),
      ...(excludeDomains && { excludeDomains }),
      ...(fromDate && { fromDate: this.serializeDate(fromDate) }),
      ...(toDate && { toDate: this.serializeDate(toDate) }),
      ...(mode && { mode }),
      ...(reasoningDepth && { reasoningDepth }),
    };

    if ('structuredOutputSchema' in params) {
      result.structuredOutputSchema = this.serializeStructuredOutputSchema(
        params.structuredOutputSchema,
      );
    }

    return result;
  }

  private serializeStructuredOutputSchema(schema: unknown): string {
    return JSON.stringify(
      isZodObject(schema) ? zodToJsonSchema(schema as ZodObject<ZodRawShape>) : schema,
    );
  }

  private serializeDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private sanitizeTaskRequest(task: TaskRequest): {
    input: SanitizedParams | FetchParams;
    type: string;
  } {
    switch (task.type) {
      case 'search':
        return {
          input: this.sanitizeSearchParams(task.input),
          type: task.type,
        };
      case 'fetch':
        return task;
      case 'research':
        return {
          input: this.sanitizeResearchParams(task.input),
          type: task.type,
        };
    }
  }

  private buildRequestConfig(params: QueryParams) {
    return {
      params,
      paramsSerializer: (rawParams: QueryParams) => this.serializeQueryParams(rawParams),
    };
  }

  private serializeQueryParams(params: QueryParams): string {
    const queryParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          queryParams.append(key, String(item));
        }
        continue;
      }

      queryParams.append(key, String(value));
    }

    return queryParams.toString();
  }

  private normalizeResearchTask(task: unknown): ResearchTask {
    return this.normalizeTask(task) as ResearchTask;
  }

  private normalizeTask(task: unknown): Task {
    const normalizedTask = task as Task & { input: Record<string, unknown> };

    switch (normalizedTask.type) {
      case 'search':
        return {
          ...normalizedTask,
          input: this.normalizeSearchLikeInput(normalizedTask.input),
        } as Task;
      case 'fetch':
        return normalizedTask;
      case 'research':
        return {
          ...normalizedTask,
          input: this.normalizeSearchLikeInput(normalizedTask.input),
        } as Task;
    }
  }

  private normalizeSearchLikeInput(input: Record<string, unknown>) {
    const { q, ...rest } = input;

    return {
      ...rest,
      query: q,
    };
  }
}
