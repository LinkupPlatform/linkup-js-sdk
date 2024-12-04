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

	constructor(config: ApiConfig) {
		this.apiKey = config.apiKey;
		this.baseUrl = config.baseUrl || "https://api.linkup.so/v1";
	}

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
