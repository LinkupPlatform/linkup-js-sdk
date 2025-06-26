import type { LinkupApiError } from '../types';

export const concatErrorAndDetails = (e: LinkupApiError): string => {
  const errorMessage = [e.error.message, ...e.error.details.map(detail => detail.message)].join(
    ' ',
  );

  return errorMessage;
};
