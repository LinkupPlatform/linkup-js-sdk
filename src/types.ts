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

export interface SearchParams<T extends SearchOutputType = SearchOutputType> {
  query: string;
  depth: SearchDepth;
  outputType: T;
  includeImages?: boolean;
  structuredOutputSchema?: StructuredOutputSchema;
}

export type LinkupSearchResponse<T extends SearchOutputType> = {
  sourcedAnswer: SourcedAnswer;
  searchResults: SearchResults;
  structured: unknown;
}[T];

export interface SourcedAnswer {
  answer: string;
  sources: {
    name: string;
    url: string;
    snippet: string;
  }[];
}

export interface SearchResults {
  results: {
    name: string;
    url: string;
    content: string;
  }[];
}
