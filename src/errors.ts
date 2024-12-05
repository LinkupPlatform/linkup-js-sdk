// Invalid request error, raised when the Linkup API returns a 400 status code.
// It is returned by the Linkup API when the request is invalid, typically when a mandatory
// parameter is missing, or isn't valid (type, structure, etc.).
export class LinkupInvalidRequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LinkupInvalidRequestError";

		if ("captureStackTrace" in Error) {
			Error.captureStackTrace(this, LinkupInvalidRequestError);
		}
	}
}

// No result error, raised when the Linkup API returns a 400 status code.
// It is returned by the Linkup API when the search query did not yield any result.
export class LinkupNoResultError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LinkupNoResultError";

		if ("captureStackTrace" in Error) {
			Error.captureStackTrace(this, LinkupNoResultError);
		}
	}
}

// Authentication error, raised when the Linkup API returns a 403 status code.
// It is returned when there is an authentication issue, typically when the API key is not valid.
export class LinkupAuthenticationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LinkupAuthenticationError";

		if ("captureStackTrace" in Error) {
			Error.captureStackTrace(this, LinkupAuthenticationError);
		}
	}
}

// Insufficient credit error, raised when the Linkup API returns a 429 status code.
// It is returned when you have run out of credits.
export class LinkupInsufficientCreditError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LinkupInsufficientCreditError";

		if ("captureStackTrace" in Error) {
			Error.captureStackTrace(this, LinkupInsufficientCreditError);
		}
	}
}

// Unknown error.
export class LinkupUnknownError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LinkupUnknownError";

		if ("captureStackTrace" in Error) {
			Error.captureStackTrace(this, LinkupUnknownError);
		}
	}
}
