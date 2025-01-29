import { ZodObject, ZodRawShape } from 'zod';

export type SearchDepth = 'standard' | 'deep';

export type SearchOutputType = 'sourcedAnswer' | 'searchResults' | 'structured';

export interface ApiConfig {
  apiKey: string;
  baseUrl?: string;
}

export type StructuredOutputSchema =
  | Record<string, unknown>
  | ZodObject<ZodRawShape>;

export interface SearchParams<T extends SearchOutputType> {
  query: string;
  depth: SearchDepth;
  outputType: T;
  includeImages?: boolean;
  structuredOutputSchema?: StructuredOutputSchema;
}

export type LinkupSearchResponse<T> = T extends 'sourcedAnswer'
  ? SourcedAnswer
  : T extends 'searchResults'
    ? SearchResults
    : T extends 'structured'
      ? StructuredOutputSchema
      : never;

export interface SearchResults {
  results: (TextSearchResult | ImageSearchResult)[];
}

export interface TextSearchResult {
  type: 'text';
  name: string;
  url: string;
  content: string;
}

export interface ImageSearchResult {
  type: 'image';
  name: string;
  url: string;
}

export interface SourcedAnswer {
  answer: string;
  sources: (Source | TextSearchResult | ImageSearchResult)[];
}

export interface Source {
  name: string;
  url: string;
  snippet: string;
}

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
