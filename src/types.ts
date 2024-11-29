/**
 * Defines the possible search depth levels for the API
 */
export type SearchDepth = "standard" | "deep";

/**
 * Defines the possible output types for search results
 */
export type SearchOutputType = "sourcedAnswer" | "searchResults" | "structured";

/**
 * Configuration options for the API client
 * @interface
 */
export interface ApiConfig {
	/** API key for authentication */
	apiKey: string;
	/** Optional base URL for the API endpoints */
	baseUrl?: string;
}

/**
 * Represents the schema for a structured output in a search request.
 *
 * @example
 * // Example as an object:
 * const schema: SearchStructuredOutputSchema = {
 *   type: "object",
 *   properties: {
 *     title: { type: "string" },
 *   },
 *   required: ["title"],
 * };
 */
export type SearchStructuredOutputSchema = Record<string, any>;

/**
 * Parameters for performing a search
 * @interface
 */
/**
 * Interface representing the parameters for a search operation.
 */
export interface SearchParams {
	/**
	 * The search query string.
	 */
	query: string;

	/**
	 * Depth of the search (standard or deep).
	 */
	depth: SearchDepth;

	/**
	 * Output types for search results.
	 */
	outputType: SearchOutputType;

	/**
	 * Schema for structured output when outputType is 'structured'.
	 * This field is optional.
	 */
	structuredOutputSchema?: SearchStructuredOutputSchema;
}

/**
 * Represents the default response types for a search operation.
 */
export type DefaultSearchResponse = SourcedAnswer | SearchResults;

/**
 * Represents the response type for a search operation, conditional on the generic type `T`.
 *
 * - If `T` extends `DefaultSearchResponse`, the response will be `DefaultSearchResponse`.
 * - Otherwise, the response will be of type `T`.
 *
 * @template T - The generic type representing the desired response structure.
 *
 * @example
 * // Example with DefaultSearchResponse:
 * type Response = SearchResponse<DefaultSearchResponse>;
 * // Result: SourcedAnswer | SearchResults
 *
 * @example
 * // Example with a custom type:
 * type CustomResponse = SearchResponse<{ customField: string }>;
 * // Result: { customField: string }
 */
export type SearchResponse<T> = T extends DefaultSearchResponse
	? DefaultSearchResponse
	: T;

/**
 * Represents an answer to a search query, including its sources.
 * @interface
 * @property {string} answer - The main answer text derived from the search.
 * @property {Array<{ name: string; url: string; snippet: string }>} sources -
 * A list of sources that provide additional context or validation for the answer.
 * - `name`: The name of the source (e.g., website or publication).
 * - `url`: The URL pointing to the source.
 * - `snippet`: A short excerpt or summary from the source.
 *
 * @example
 * const sourcedAnswer: SourcedAnswer = {
 *   answer: "The capital of France is Paris.",
 *   sources: [
 *     {
 *       name: "Wikipedia",
 *       url: "https://en.wikipedia.org/wiki/Paris",
 *       snippet: "Paris is the capital and most populous city of France.",
 *     },
 *     {
 *       name: "Britannica",
 *       url: "https://www.britannica.com/place/Paris",
 *       snippet: "Paris, city and capital of France, located along the Seine River.",
 *     },
 *   ],
 * };
 */
export interface SourcedAnswer {
	answer: string;
	sources: {
		name: string;
		url: string;
		snippet: string;
	}[];
}

/**
 * Represents a list of search results obtained from a search query.
 * @interface
 * @property {Array<{ name: string; url: string; content: string }>} results -
 * A list of search results.
 * - `name`: The title or name of the result (e.g., webpage or document title).
 * - `url`: The URL of the search result.
 * - `content`: A snippet or preview of the content within the result.
 *
 * @example
 * const searchResults: SearchResults = {
 *   results: [
 *     {
 *       name: "Paris - Wikipedia",
 *       url: "https://en.wikipedia.org/wiki/Paris",
 *       content: "Paris is the capital and most populous city of France.",
 *     },
 *     {
 *       name: "Visit Paris",
 *       url: "https://www.parisinfo.com/",
 *       content: "Discover the best attractions and activities in Paris.",
 *     },
 *   ],
 * };
 */
export interface SearchResults {
	results: {
		name: string;
		url: string;
		content: string;
	}[];
}
