import {
	ApiConfig,
	DefaultSearchResponse,
	SearchOutputType,
	SearchParams,
	SearchResponse,
	SearchResults,
	SourcedAnswer,
} from "./types";
import { LinkUpError } from "./errors";
import fetch from "node-fetch";

export class LinkUpClient {
	private readonly apiKey: string;
	private readonly baseUrl: string;

	/**
	 * Creates a new instance of the LinkUp API client
	 * @param config - Configuration options for the client
	 * @param config.apiKey - API key for authentication
	 * @param config.baseUrl - Optional base URL for the API (defaults to production URL)
	 */
	constructor(config: ApiConfig) {
		this.apiKey = config.apiKey;
		this.baseUrl = config.baseUrl || "https://api.linkup.so/v1";
	}

	/**
	 * Performs a search via the API
	 * @param params - Search parameters
	 * @returns The search results
	 * @throws {LinkUpError} If an error occurs during the request
	 */
	async search<T = DefaultSearchResponse>(
		params: SearchParams
	): Promise<SearchResponse<T>> {
		try {
			const searchParams = new URLSearchParams(this.getSearchParams(params));
			const response = await fetch(`${this.baseUrl}/search?${searchParams}`, {
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
				},
			});

			if (response.status !== 200) {
				throw new LinkUpError(
					`Failed to perform search, error code: ${response.statusText}`
				);
			}

			const data = await response.json();

			return this.validateSearchResponse<T>(data, params.outputType);
		} catch (error) {
			throw new LinkUpError(`Failed to perform search: ${error}`);
		}
	}

	/**
	 * Constructs search parameters for the API request.
	 *
	 * @param {Object} params - The parameters for the search.
	 * @param {string} params.query - The search query string.
	 * @param {string} params.depth - The depth of the search, e.g., 'standard' or 'deep'.
	 * @param {string} params.outputType - The type of output expected, e.g., 'structured' or 'unstructured'.
	 * @param {object | undefined} params.structuredOutputSchema - The JSON schema defining the expected structure of the output (required when `outputType` is 'structured').
	 * @returns {Record<string, string>} The constructed search parameters as key-value pairs.
	 *
	 * @throws {TypeError} If `structuredOutputSchema` is not provided when `outputType` is 'structured'.
	 * @throws {TypeError} If `structuredOutputSchema` is not of type `object` when required.
	 *
	 * @example
	 * // Example usage
	 * const searchParams = getSearchParams({
	 *   query: "Can you tell me which women were awarded the Physics Nobel Prize",
	 *   depth: "standard",
	 *   outputType: "structured",
	 *   structuredOutputSchema: {
	 *     type: "object",
	 *     properties: {
	 *       name: { type: "string" },
	 *     },
	 *     required: ["name"],
	 *   },
	 * });
	 */
	private getSearchParams({
		query,
		depth,
		outputType,
		structuredOutputSchema,
	}: SearchParams): Record<string, string> {
		const searchParams: Record<string, string> = {
			q: query,
			depth,
			outputType,
		};

		if (outputType === "structured") {
			if (!structuredOutputSchema) {
				throw new TypeError(
					`A structuredOutputSchema must be provided when using outputType = 'structured'`
				);
			}

			if (typeof structuredOutputSchema === "object") {
				searchParams.structuredOutputSchema = JSON.stringify(
					structuredOutputSchema
				);
			} else {
				throw new TypeError(
					`Unexpected structuredOutputSchema type: '${typeof structuredOutputSchema}'`
				);
			}
		}

		return searchParams;
	}

	/**
	 * Validates and transforms the search response based on the specified output type.
	 *
	 * @template T - The type of the search response.
	 * @param {unknown} searchResponse - The raw search response to be validated and transformed.
	 * @param {SearchOutputType} outputType - The type of the output to determine the structure of the response.
	 * @returns {SearchResponse<T>} - The validated and transformed search response.
	 */
	private validateSearchResponse<T>(
		searchResponse: unknown,
		outputType: SearchOutputType
	): SearchResponse<T> {
		switch (outputType) {
			case "sourcedAnswer":
				return {
					answer: (searchResponse as SourcedAnswer).answer,
					sources: (searchResponse as SourcedAnswer).sources,
				} as SearchResponse<T>;
			case "searchResults":
				return {
					results: (searchResponse as SearchResults).results,
				} as SearchResponse<T>;
			case "structured":
			default:
				return searchResponse as SearchResponse<T>;
		}
	}
}
