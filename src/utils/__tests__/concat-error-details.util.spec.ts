import { LinkupApiError } from '../../types';
import { concatErrorAndDetails } from '../index';

describe('concatErrorAndDetails', () => {
  it('should return the error message with the details', () => {
    const error: LinkupApiError = {
      statusCode: 400,
      error: {
        code: 'ERROR',
        message: 'Error description',
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
      },
    };

    const result = concatErrorAndDetails(error);

    expect(result).toBe('Error description Detail 1 Detail 2');
  });
  it('should return the error message when there is no details', () => {
    const error: LinkupApiError = {
      statusCode: 400,
      error: {
        code: 'ERROR',
        message: 'Error description',
        details: [],
      },
    };

    const result = concatErrorAndDetails(error);

    expect(result).toBe('Error description');
  });
});
