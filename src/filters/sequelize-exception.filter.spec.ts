import { ArgumentsHost } from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { SequelizeExceptionFilter } from './sequelize-exception.filter';
import { cast } from 'src/testing/cast';

describe('SequelizeExceptionFilter', () => {
  let filter: SequelizeExceptionFilter;
  let statusFn: jest.Mock;
  let jsonFn: jest.Mock;

  beforeEach(() => {
    filter = new SequelizeExceptionFilter();
    jsonFn = jest.fn();
    statusFn = jest.fn().mockReturnValue({ json: jsonFn });
  });

  function buildHost(): ArgumentsHost {
    return cast<ArgumentsHost>({
      switchToHttp: () => ({
        getResponse: () => ({ status: statusFn, json: jsonFn }),
      }),
    });
  }

  it('maps a unique constraint error to a 409 with details', () => {
    const exception = cast<UniqueConstraintError>({
      errors: [
        { message: 'youtube_handle must be unique' },
        { message: 'name must be unique' },
      ],
    });

    filter.catch(exception, buildHost());

    expect(statusFn).toHaveBeenCalledWith(409);
    expect(jsonFn).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'Unique constraint violation',
      error: 'Conflict',
      details: ['youtube_handle must be unique', 'name must be unique'],
    });
  });

  it('handles an empty errors array', () => {
    const exception = cast<UniqueConstraintError>({ errors: [] });

    filter.catch(exception, buildHost());

    expect(jsonFn).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'Unique constraint violation',
      error: 'Conflict',
      details: [],
    });
  });
});
