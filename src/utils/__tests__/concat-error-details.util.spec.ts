import { LinkupApiError } from '../../types';
import { concatErrorAndDetails } from '../refine-error.utils';

describe('concatErrorAndDetails', () => {
  it('should return the error message with the details', () => {
    const error: LinkupApiError = {
      error: {
        code: 'ERROR',
        details: [
          {
            field: 'field1',
            message: 'Detail 1',
          },
          {
            field: 'field2',
            message: 'Detail 2',
          },
        ],
        message: 'Error description',
      },
      statusCode: 400,
    };

    const result = concatErrorAndDetails(error);

    expect(result).toBe('Error description Detail 1 Detail 2');
  });
  it('should return the error message when there is no details', () => {
    const error: LinkupApiError = {
      error: {
        code: 'ERROR',
        details: [],
        message: 'Error description',
      },
      statusCode: 400,
    };

    const result = concatErrorAndDetails(error);

    expect(result).toBe('Error description');
  });
});
