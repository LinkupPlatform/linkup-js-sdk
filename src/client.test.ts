import { LinkUpClient } from "./client";
import {
	LinkupAuthenticationError,
	LinkupInsufficientCreditError,
	LinkupInvalidRequestError,
	LinkupNoResultError,
	LinkupUnknownError,
} from "./errors";
import { SearchParams } from "./types";
import fetch from "cross-fetch";

jest.mock("cross-fetch", () => jest.fn());

const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("LinkUpClient", () => {
	let client: LinkUpClient;
	const mockApiKey = "test-api-key";
	const mockBaseUrl = "https://api.test.com/v1";

	beforeEach(() => {
		client = new LinkUpClient({ apiKey: mockApiKey, baseUrl: mockBaseUrl });
		jest.clearAllMocks();
	});

	describe("constructor", () => {
		it("should use default base URL if not provided", () => {
			const defaultClient = new LinkUpClient({ apiKey: mockApiKey });
			expect(defaultClient).toBeTruthy();
		});

		it("should use custom base URL if provided", () => {
			expect(client).toBeTruthy();
		});
	});

	describe("search", () => {
		const mockSearchParams: SearchParams = {
			query: "test",
			depth: "deep",
			outputType: "sourcedAnswer",
		};
		const mockSuccessResponse = {
			answer:
				"Minim adipisicing veniam sit enim adipisicing et anim irure enim nisi proident consequat irure mollit.",
			sources: ["source1", "source2"],
		};

		it("should make a successful API call with correct parameters", async () => {
			mockedFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockSuccessResponse,
			} as any);

			const result = await client.search(mockSearchParams);

			expect(mockedFetch).toHaveBeenCalledWith(
				expect.stringContaining(
					`${mockBaseUrl}/search?q=test&depth=deep&outputType=sourcedAnswer`
				),
				expect.objectContaining({
					headers: {
						Authorization: `Bearer ${mockApiKey}`,
					},
				})
			);
			expect(result).toEqual(mockSuccessResponse);
		});

		it("should correctly handle sourcedAnswer output type", async () => {
			mockedFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockSuccessResponse,
			} as any);

			const result = await client.search(mockSearchParams);

			expect(result).toHaveProperty("answer");
			expect(result).toHaveProperty("sources");
		});

		it("should correctly handle searchResults output type", async () => {
			const searchResultsResponse = {
				results: ["result1", "result2"],
			};

			mockedFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => searchResultsResponse,
			} as any);

			const result = await client.search({
				...mockSearchParams,
				outputType: "searchResults" as const,
			});

			expect(result).toHaveProperty("results");
		});

		it("should correctly handle structured output type", async () => {
			const mockStructuredResponse = {
				structured_data: {
					title: "string",
					content: "string",
					source: {
						url: "string",
					},
				},
			};

			mockedFetch.mockImplementationOnce(
				() =>
					Promise.resolve({
						ok: true,
						json: () => Promise.resolve(mockStructuredResponse),
					}) as Promise<any>
			);

			const result = await client.search({
				...mockSearchParams,
				outputType: "structured",
			});

			expect(result).toEqual(mockStructuredResponse);
		});

		const testErrorCases = [
			{
				status: 400,
				message: "The query did not yield any result",
				expectedError: LinkupNoResultError,
			},
			{
				status: 400,
				message: "Invalid request",
				expectedError: LinkupInvalidRequestError,
			},
			{
				status: 403,
				message: "Authentication failed",
				expectedError: LinkupAuthenticationError,
			},
			{
				status: 429,
				message: "Insufficient credits",
				expectedError: LinkupInsufficientCreditError,
			},
			{
				status: 500,
				message: "Unknown error",
				expectedError: LinkupUnknownError,
			},
		];

		testErrorCases.forEach(({ status, message, expectedError }) => {
			it(`should throw ${expectedError.name} for status ${status}`, async () => {
				const mockResponse = new Response(JSON.stringify({ message }), {
					status,
				});
				mockedFetch.mockResolvedValueOnce(mockResponse);

				try {
					await client.search(mockSearchParams);
				} catch (error: any) {
					expect(error).toBeInstanceOf(expectedError);
					expect(error.message).toBe(message);
					expect(error.name).toBe(expectedError.name);
				}
			});
		});

		it("should fallback to default error message when response cannot be parsed as JSON", async () => {
			mockedFetch.mockImplementationOnce(
				() =>
					Promise.resolve({
						ok: false,
						status: 500,
						statusText: "Internal Server Error",
						json: () => Promise.reject(new Error("JSON parsing failed")),
					}) as Promise<any>
			);

			await expect(client.search(mockSearchParams)).rejects.toThrow(
				"An unknown error occurred"
			);
		});

		it("should handle non-http error", async () => {
			await expect(client["throwSearchError"]("Invalid JSON")).rejects.toThrow(
				LinkupUnknownError
			);
		});
	});
});
