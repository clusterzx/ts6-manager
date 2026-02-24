import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class TSApiError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'TSApiError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(`[Error] ${err.name}: ${err.message}`);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
    return;
  }

  if (err instanceof TSApiError) {
    res.status(502).json({
      error: 'TeamSpeak API Error',
      code: err.code,
      details: err.message,
    });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
