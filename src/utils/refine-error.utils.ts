import {
  LinkupAuthenticationError,
  LinkupError,
  LinkupFetchError,
  LinkupInsufficientCreditError,
  LinkupInvalidRequestError,
  LinkupNoResultError,
  LinkupTooManyRequestsError,
  LinkupUnknownError,
} from '../errors';
import type { LinkupApiError } from '../types';

export const concatErrorAndDetails = (e: LinkupApiError): string => {
  const errorMessage = [e.error.message, ...e.error.details.map(detail => detail.message)].join(
    ' ',
  );

  return errorMessage;
};

export const refineError = (e: LinkupApiError): LinkupError => {
  const { statusCode, error } = e;
  const { code, message } = error;

  switch (statusCode) {
    case 400:
      if (code === 'SEARCH_QUERY_NO_RESULT') {
        return new LinkupNoResultError(message);
      }
      if (code === 'FETCH_ERROR') {
        return new LinkupFetchError(message);
      }
      return new LinkupInvalidRequestError(concatErrorAndDetails(e));
    case 401:
    case 403:
      return new LinkupAuthenticationError(message);
    case 429:
      switch (code) {
        case 'INSUFFICIENT_FUNDS_CREDITS':
          return new LinkupInsufficientCreditError(message);
        case 'TOO_MANY_REQUESTS':
          return new LinkupTooManyRequestsError(message);
        default:
          return new LinkupUnknownError(`An unknown error occurred: ${error.message}`);
      }
    default:
      return new LinkupUnknownError(`An unknown error occurred: ${error.message}`);
  }
};
