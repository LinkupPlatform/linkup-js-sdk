/** biome-ignore-all lint/complexity/noBannedTypes: needed for conditional props */
import { ZodObject, ZodRawShape } from 'zod';
import type { X402Signer } from './x402/types';

export type SearchDepth = 'standard' | 'deep' | 'fast';
export type ResearchMode = 'answer' | 'auto' | 'investigate' | 'research';
export type ResearchReasoningDepth = 'S' | 'M' | 'L' | 'XL';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type TaskType = 'search' | 'fetch' | 'research';
export type SortDirection = 'asc' | 'desc';
export type TaskSortBy = 'createdAt' | 'updatedAt';

export type ApiKeyConfig = { apiKey: string; baseUrl?: string };

export type X402Config = { signer: X402Signer; baseUrl?: string };

export type ApiConfig = ApiKeyConfig | X402Config;

export type Structured = Record<string, unknown>;

export type StructuredInputSchema = Structured | ZodObject<ZodRawShape>;

export type FetchImage = {
  alt: string;
  url: string;
};
export type StructuredWithSources = {
  data: Structured;
  sources: StructuredSource[];
};

export type StructuredSource = TextSearchResult | ImageSearchResult;

type BaseSearchRequestParams = {
  query: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  fromDate?: Date;
  toDate?: Date;
};

export type SearchParams = BaseSearchRequestParams & {
  includeImages?: boolean;
  depth: SearchDepth;
  maxResults?: number;
} & (
    | {
        outputType: 'searchResults';
      }
    | {
        outputType: 'sourcedAnswer';
        includeInlineCitations?: boolean;
      }
    | {
        outputType: 'structured';
        includeSources?: boolean;
        structuredOutputSchema: StructuredInputSchema;
      }
  );

export type LinkupSearchResponse<T> = T extends { outputType: 'structured'; includeSources: true }
  ? StructuredWithSources
  : T extends { outputType: 'structured' }
    ? Structured
    : T extends { outputType: 'sourcedAnswer' }
      ? SourcedAnswer
      : SearchResults;

export type SearchResults = {
  results: (TextSearchResult | ImageSearchResult)[];
};

export type TextSearchResult = {
  type: 'text';
  name: string;
  url: string;
  content: string;
  favicon: string;
};

export type ImageSearchResult = {
  type: 'image';
  name: string;
  url: string;
};

export type SourcedAnswer = {
  answer: string;
  sources: Source[];
};

export type Source = {
  name: string;
  url: string;
  snippet: string;
  favicon: string;
};

export type LinkupApiError = {
  statusCode: number;
  error: {
    code: string;
    message: string;
    details: {
      field: string;
      message: string;
    }[];
  };
};

export type FetchParams = {
  url: string;
  renderJs?: boolean;
  includeRawHtml?: boolean;
  extractImages?: boolean;
};

export type LinkupFetchResponse<T extends FetchParams = FetchParams> = {
  markdown: string;
} & ConditionalProp<T['includeRawHtml'], { rawHtml: string }> &
  ConditionalProp<T['extractImages'], { images: FetchImage[] }>;

export type ResearchParams = BaseSearchRequestParams &
  (
    | {
        outputType: 'sourcedAnswer';
      }
    | {
        outputType: 'structured';
        structuredOutputSchema: StructuredInputSchema;
      }
  ) & {
    mode?: ResearchMode;
    reasoningDepth?: ResearchReasoningDepth;
  };

export type ResearchResult = SourcedAnswer | Structured;

type BaseTaskInput = {
  query: string;
  excludeDomains?: string[];
  fromDate?: string;
  includeDomains?: string[];
  structuredOutputSchema?: Structured;
  toDate?: string;
};

export type SearchTaskInput = BaseTaskInput & {
  includeImages?: boolean;
  maxResults?: number;
  depth: SearchDepth;
} & (
    | {
        outputType: 'searchResults';
      }
    | {
        includeInlineCitations?: boolean;
        outputType: 'sourcedAnswer';
      }
    | {
        includeSources?: boolean;
        outputType: 'structured';
        structuredOutputSchema: Structured;
      }
  );

export type ResearchTaskInput = BaseTaskInput & {
  mode?: ResearchMode;
  reasoningDepth?: ResearchReasoningDepth;
} & (
    | {
        outputType: 'sourcedAnswer';
      }
    | {
        outputType: 'structured';
        structuredOutputSchema: Structured;
      }
  );

export type TaskRequest =
  | { type: 'search'; input: SearchParams }
  | { type: 'fetch'; input: FetchParams }
  | { type: 'research'; input: ResearchParams };

type TaskBase<TType extends TaskType, TInput, TOutput> = {
  createdAt: string;
  error: string | null;
  id: string;
  input: TInput;
  output: TOutput | null;
  status: TaskStatus;
  type: TType;
  updatedAt: string;
};

export type SearchTask = TaskBase<
  'search',
  SearchTaskInput,
  SearchResults | SourcedAnswer | Structured | StructuredWithSources
>;

export type FetchTaskOutput = {
  markdown: string;
  images?: FetchImage[];
  rawHtml?: string;
};

export type FetchTask = TaskBase<'fetch', FetchParams, FetchTaskOutput>;

export type ResearchTask = TaskBase<'research', ResearchTaskInput, ResearchResult>;

export type Task = SearchTask | FetchTask | ResearchTask;

export type PaginationMetadata = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResearchTasks = {
  data: ResearchTask[];
  metadata: PaginationMetadata;
};

export type TasksQuota = {
  inFlight: number;
  limit: number;
};

export type PaginatedTasks = {
  data: Task[];
  metadata: PaginationMetadata;
  quota: TasksQuota;
};

export type ListResearchParams = {
  page?: number;
  pageSize?: number;
  sortBy?: TaskSortBy;
  sortDirection?: SortDirection;
};

export type ListTasksParams = ListResearchParams & {
  status?: TaskStatus | TaskStatus[];
  type?: TaskType | TaskType[];
};

type ConditionalProp<Condition, PropType> = Condition extends true ? PropType : {};
