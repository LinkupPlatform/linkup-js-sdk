/** biome-ignore-all lint/complexity/noBannedTypes: needed for conditional props */
import { ZodObject, ZodRawShape } from 'zod';

export type SearchDepth = 'standard' | 'deep';

export type ApiConfig = {
  apiKey: string;
  baseUrl?: string;
};

export type Structured = Record<string, unknown>;

export type StructuredInputSchema = Structured | ZodObject<ZodRawShape>;

export type StructuredWithSources = {
  data: Structured;
  sources: StructuredSource[];
};

export type StructuredSource = {
  url: string;
  content: string;
  name: string;
  type: string;
};

export type SearchParams = {
  query: string;
  depth: SearchDepth;
  includeImages?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  fromDate?: Date;
  toDate?: Date;
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
};

export type ImageSearchResult = {
  type: 'image';
  name: string;
  url: string;
};

export type SourcedAnswer = {
  answer: string;
  sources: (Source | TextSearchResult | ImageSearchResult)[];
};

export type Source = {
  name: string;
  url: string;
  snippet: string;
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
  ConditionalProp<T['extractImages'], { images: string[] }>;

type ConditionalProp<Condition, PropType> = Condition extends true ? PropType : {};
