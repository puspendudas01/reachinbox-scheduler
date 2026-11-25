import { STATUS_CODES } from 'node:http';
import type { ErrorRequestHandler } from 'express';
import { logger } from '../config/logger';
import { HttpError } from '../utils/http-error';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const declaredStatus =
    error instanceof Error && 'status' in error ? error.status : undefined;
  const status =
    typeof declaredStatus === 'number' &&
    Number.isInteger(declaredStatus) &&
    declaredStatus >= 400 &&
    declaredStatus < 600
      ? declaredStatus
      : 500;

  if (status >= 500) {
    logger.error(
      { err: error, method: request.method, status },
      'Request failed',
    );
  }

  response.status(status).json({
    error:
      error instanceof HttpError
        ? error.message
        : (STATUS_CODES[status] ?? 'Request failed'),
  });
};
