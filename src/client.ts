import {
	LinkupAuthenticationError,
	LinkupInsufficientCreditError,
	LinkupInvalidRequestError,
	LinkupNoResultError,
	LinkupUnknownError,
} from "./errors";
import {
	ApiConfig,
	LinkupSearchResponse,
	SearchOutputType,
	SearchParams,
	SearchResponse,
	SearchResults,
	SourcedAnswer,
} from "./types";
import fetch from "cross-fetch";

export class LinkUpClient {
	private readonly apiKey: string;
	private readonly baseUrl: string;

	constructor(config: ApiConfig) {
		this.apiKey = config.apiKey;
		this.baseUrl = config.baseUrl || "https://api.linkup.so/v1";
	}

	async search<T = LinkupSearchResponse>(
		params: SearchParams
	): Promise<SearchResponse<T>> {
		const searchParams = new URLSearchParams(this.getSearchParams(params));
		const response = await fetch(`${this.baseUrl}/search?${searchParams}`, {
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
			},
		});

		if (!response.ok) {
			await this.throwSearchError(response);
		}

		const data = await response.json();

		return this.validateSearchResponse<T>(data, params.outputType);
	}

	private getSearchParams({
		query,
		depth,
		outputType,
	}: SearchParams): Record<string, string> {
		const searchParams: Record<string, string> = {
			q: query,
			depth,
			outputType,
		};

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

	private async throwSearchError(error: unknown): Promise<never> {
		let errorMessage = "An unknown error occurred";

		if (
			error &&
			typeof error === "object" &&
			"status" in error &&
			"json" in error
		) {
			const errorWithJson = error as {
				status: number;
				json: () => Promise<any>;
			};
			const errorBody = await errorWithJson.json().catch(() => null);

			if (errorBody && errorBody.message) {
				errorMessage = errorBody.message;
			}

			switch (error.status) {
				case 400:
					if (errorMessage === "The query did not yield any result") {
						throw new LinkupNoResultError(errorMessage);
					}
					throw new LinkupInvalidRequestError(errorMessage);
				case 403:
					throw new LinkupAuthenticationError(errorMessage);
				case 429:
					throw new LinkupInsufficientCreditError(errorMessage);
				default:
					throw new LinkupUnknownError(errorMessage);
			}
		}

		throw new LinkupUnknownError(errorMessage);
	}
}
