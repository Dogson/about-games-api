import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';
import { Response } from 'express';

@Catch(UniqueConstraintError)
export class SequelizeExceptionFilter implements ExceptionFilter {
  catch(exception: UniqueConstraintError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response: Response = ctx.getResponse();

    // You can customize the message with info from exception.errors if needed
    const message = 'Unique constraint violation';

    response.status(HttpStatus.CONFLICT).json({
      statusCode: HttpStatus.CONFLICT,
      message,
      error: 'Conflict',
      details: exception.errors.map((e) => e.message),
    });
  }
}
