export type LinkupErrorDetail = {
  field: string;
  message: string;
};

export abstract class LinkupError extends Error {}

// Invalid request error, raised when the Linkup API returns a 400 status code.
// It is returned by the Linkup API when the request is invalid, typically when a mandatory
// parameter is missing, or isn't valid (type, structure, etc.).
export class LinkupInvalidRequestError extends LinkupError {
  constructor(message: string) {
    super(message);

    this.name = LinkupInvalidRequestError.name;

    if ('captureStackTrace' in Error) {
      Error.captureStackTrace(this, LinkupInvalidRequestError);
    }
  }
}

// No result error, raised when the Linkup API returns a 400 status code.
// It is returned by the Linkup API when the search query did not yield any result.
export class LinkupNoResultError extends LinkupError {
  constructor(message?: string) {
    super(message);
    this.name = LinkupNoResultError.name;

    if ('captureStackTrace' in Error) {
      Error.captureStackTrace(this, LinkupNoResultError);
    }
  }
}

// Authentication error, raised when the Linkup API returns a 403 status code.
// It is returned when there is an authentication issue, typically when the API key is not valid.
export class LinkupAuthenticationError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = LinkupAuthenticationError.name;

    if ('captureStackTrace' in Error) {
      Error.captureStackTrace(this, LinkupAuthenticationError);
    }
  }
}

// Insufficient credit error, raised when the Linkup API returns a 429 status code.
// It is returned when you have run out of credits.
export class LinkupInsufficientCreditError extends LinkupError {
  constructor(message?: string) {
    super(message);
    this.name = LinkupInsufficientCreditError.name;

    if ('captureStackTrace' in Error) {
      Error.captureStackTrace(this, LinkupInsufficientCreditError);
    }
  }
}

// Too many requests error, raised when the Linkup API returns a 429 status code.
// It is returned when you are sending too many requests at a time.
export class LinkupTooManyRequestsError extends LinkupError {
  constructor(message?: string) {
    super(message);
    this.name = LinkupTooManyRequestsError.name;

    if ('captureStackTrace' in Error) {
      Error.captureStackTrace(this, LinkupTooManyRequestsError);
    }
  }
}

// Unknown error
export class LinkupUnknownError extends LinkupError {
  constructor(message: string) {
    super(message);
    this.name = LinkupUnknownError.name;

    if ('captureStackTrace' in Error) {
      Error.captureStackTrace(this, LinkupUnknownError);
    }
  }
}

// Fetch error, raised when the Linkup API returns a 400 status code.
// It is returned by the Linkup API when the fetch failed.
export class LinkupFetchError extends LinkupError {
  constructor(message?: string) {
    super(message);
    this.name = LinkupFetchError.name;

    if ('captureStackTrace' in Error) {
      Error.captureStackTrace(this, LinkupFetchError);
    }
  }
}
