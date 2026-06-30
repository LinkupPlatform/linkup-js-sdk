import {
  FetchUrlIsFileError,
  LinkupAuthenticationError,
  LinkupBudgetLimitExceededError,
  LinkupError,
  LinkupFetchError,
  LinkupFetchResponseTooLargeError,
  LinkupFetchUnsupportedContentTypeError,
  LinkupInsufficientCreditError,
  LinkupInvalidRequestError,
  LinkupNoResultError,
  LinkupPaymentRequiredError,
  LinkupTaskNotFoundError,
  LinkupTasksQueueLimitExceededError,
  LinkupTooManyRequestsError,
  LinkupUnknownError,
} from '../errors';
import type { LinkupApiError } from '../types';

export const concatErrorAndDetails = (e: LinkupApiError): string => {
  const details = e.error?.details ?? [];
  const errorMessage = [
    e.error?.message ?? 'Unknown error',
    ...details.map(detail => detail.message),
  ].join(' ');

  return errorMessage;
};

export const refineError = (e: LinkupApiError): LinkupError => {
  const { statusCode, error } = e;

  if (!error || typeof error !== 'object') {
    return new LinkupUnknownError(`An unknown error occurred: ${JSON.stringify(e)}`);
  }

  const { code, message } = error;

  switch (statusCode) {
    case 400:
      switch (code) {
        case 'SEARCH_QUERY_NO_RESULT':
          return new LinkupNoResultError(message);
        case 'FETCH_ERROR':
          return new LinkupFetchError(message);
        case 'FETCH_RESPONSE_TOO_LARGE':
          return new LinkupFetchResponseTooLargeError(message);
        case 'FETCH_UNSUPPORTED_CONTENT_TYPE':
          return new LinkupFetchUnsupportedContentTypeError(message);
        case 'FETCH_URL_IS_FILE':
          return new FetchUrlIsFileError(message);
        default:
          return new LinkupInvalidRequestError(concatErrorAndDetails(e));
      }
    case 402:
      return new LinkupPaymentRequiredError(message);
    case 401:
      return new LinkupAuthenticationError(message);
    case 403:
      switch (code) {
        case 'TASK_TYPE_NOT_SUPPORTED':
          return new LinkupUnknownError(`Unsupported task type: ${message}`);
        default:
          return new LinkupAuthenticationError(message);
      }
    case 404:
      switch (code) {
        case 'TASK_NOT_FOUND':
          return new LinkupTaskNotFoundError(message);
        default:
          return new LinkupUnknownError(`An unknown error occurred: ${error.message}`);
      }
    case 429:
      switch (code) {
        case 'INSUFFICIENT_FUNDS_CREDITS':
          return new LinkupInsufficientCreditError(message);
        case 'EXCEED_BUDGET_LIMIT':
          return new LinkupBudgetLimitExceededError(message);
        case 'TASKS_QUEUE_LIMIT_EXCEEDED':
          return new LinkupTasksQueueLimitExceededError(message);
        case 'TOO_MANY_REQUESTS':
          return new LinkupTooManyRequestsError(message);
        default:
          return new LinkupUnknownError(`An unknown error occurred: ${error.message}`);
      }
    default:
      return new LinkupUnknownError(`An unknown error occurred: ${error.message}`);
  }
};
