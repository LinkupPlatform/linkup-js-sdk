export type SearchDepth = "standard" | "deep";

export type SearchOutputType = "sourcedAnswer" | "searchResults" | "structured";

export interface ApiConfig {
	apiKey: string;
	baseUrl?: string;
}

export type SearchStructuredOutputSchema = Record<string, any>;

export interface SearchParams {
	query: string;
	depth: SearchDepth;
	outputType: SearchOutputType;
	structuredOutputSchema?: SearchStructuredOutputSchema;
}

export type LinkupSearchResponse = SourcedAnswer | SearchResults;

export type SearchResponse<T> = T extends LinkupSearchResponse
	? LinkupSearchResponse
	: T;

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
