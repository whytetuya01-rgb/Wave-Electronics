import { z } from 'zod';

// 24-char hex string - the same shape mongoose.isValidObjectId() accepts,
// used wherever a request references a Mongo document by id.
const objectIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid id');

// Validates the :id route param for Job approval. Mongoose would otherwise
// throw a CastError for a malformed id, which the generic catch block turns
// into an unhelpful 500 - this gives a clean 400 instead, before performJobApproval
// is ever called.
export const jobIdParamSchema = z.object({
  id: objectIdString,
});

// POST /jobs/:id/issue - mirrors the sanitization performMaterialIssue()
// already does (valid component ids, positive qty, non-empty idempotency
// key); schema-level validation runs first so a malformed request never
// reaches the transaction.
export const materialIssueBodySchema = z.object({
  items: z
    .array(
      z.object({
        componentId: objectIdString,
        qty: z.coerce.number().positive('Issue quantity must be greater than zero'),
      })
    )
    .min(1, 'At least one component line is required to issue material'),
  idempotencyKey: z.string().trim().min(1, 'An idempotency key is required to issue material'),
});

// POST /jobs/:id/receipts - mirrors the sanitization performJobReceipt()
// already does. Both arrays are optional (a receipt may be circuits-only or
// returns-only); the "at least one non-zero line" cross-field rule stays in
// the controller, which already enforces it with a specific message.
export const jobReceiptBodySchema = z.object({
  vendorRefNumber: z.string().trim().optional(),
  circuitReceipts: z
    .array(
      z.object({
        jobCircuitId: objectIdString,
        goodQty: z.coerce.number().min(0).optional().default(0),
        rejectedQty: z.coerce.number().min(0).optional().default(0),
        rejectionReason: z.string().trim().optional(),
      })
    )
    .optional()
    .default([]),
  componentReturns: z
    .array(
      z.object({
        componentId: objectIdString,
        challanId: objectIdString,
        receivedQty: z.coerce.number().min(0).optional().default(0),
        damagedQty: z.coerce.number().min(0).optional().default(0),
      })
    )
    .optional()
    .default([]),
  remarks: z.string().trim().optional(),
  idempotencyKey: z.string().trim().min(1, 'An idempotency key is required to record a job receipt'),
});
