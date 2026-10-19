import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

// Generic request-shape validation middleware. Runs BEFORE a controller, so
// malformed requests (missing fields, wrong types, bad ObjectId strings) are
// rejected with a consistent 400 shape before any business logic - including
// before a transaction is ever opened. This is intentionally additive: it
// does not replace the business-rule checks already inside each `perform*`
// function (insufficient stock, over-issue, wrong job status, etc.) - those
// still run exactly as before. On success, the parsed/coerced value replaces
// req[source] so downstream code sees normalized types (e.g. numeric strings
// coerced to numbers), matching what the existing manual `Number(...)`
// conversions already did.
export function validate<T>(schema: ZodType<T>, source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      res.status(400).json({
        message: errors[0]?.message || 'Invalid request',
        errors,
      });
      return;
    }
    (req as any)[source] = result.data;
    next();
  };
}
