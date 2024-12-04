// Invalid request error, raised when the Linkup API returns a 400 status code.
// It is returned by the Linkup API when the request is invalid, typically when a mandatory
// parameter is missing, or isn't valid (type, structure, etc.).
export class LinkupInvalidRequestError extends Error {
	constructor(
		message: string,
		public statusCode?: number
	) {
		super(message);
		this.name = "LinkupInvalidRequestError";
		this.statusCode = statusCode ?? 400;
	}
}

// No result error, raised when the Linkup API returns a 400 status code.
// It is returned by the Linkup API when the search query did not yield any result.
export class LinkupNoResultError extends Error {
	constructor(
		message: string,
		public statusCode?: number
	) {
		super(message);
		this.name = "LinkupNoResultError";
		this.statusCode = statusCode ?? 400;
	}
}

// Authentication error, raised when the Linkup API returns a 403 status code.
// It is returned when there is an authentication issue, typically when the API key is not valid.
export class LinkupAuthenticationError extends Error {
	constructor(
		message: string,
		public statusCode?: number
	) {
		super(message);
		this.name = "LinkupAuthenticationError";
		this.statusCode = statusCode ?? 403;
	}
}

// Insufficient credit error, raised when the Linkup API returns a 429 status code.
// It is returned when you have run out of credits.
export class LinkupInsufficientCreditError extends Error {
	constructor(
		message: string,
		public statusCode?: number
	) {
		super(message);
		this.name = "LinkupInsufficientCreditError";
		this.statusCode = statusCode ?? 429;
	}
}

// Unknown error.
export class LinkupUnknownError extends Error {
	constructor(
		message: string,
		public statusCode?: number
	) {
		super(message);
		this.name = "LinkupUnknownError";
		this.statusCode = statusCode ?? 500;
	}
}
