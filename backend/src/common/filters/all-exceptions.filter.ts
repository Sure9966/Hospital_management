import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || message;
    } else if (exception && typeof exception === 'object') {
      const err = exception as any;
      const errStr = (err.message || '') + (err.code || '');
      if (
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNRESET' ||
        errStr.toLowerCase().includes('timeout') ||
        errStr.toLowerCase().includes('connection terminated')
      ) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Database connection temporary timeout. Retrying request...';
        this.logger.warn(`⚠️ DB Connection Timeout on ${request.url}: ${err.message}`);
      } else {
        this.logger.error(`Unhandled Exception on ${request.url}:`, err);
        message = err.message || message;
      }
    }

    if (!response.headersSent) {
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message,
      });
    }
  }
}
