import { z } from 'zod';

const objectIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid id');

// POST /stock-inward - mirrors the per-row validation createStockInward()
// already does (component required, qty > 0, unitRate >= 0). Schema-level
// validation runs first so a malformed request is rejected with a
// consistent 400 before any component is looked up or any stock is touched.
export const createStockInwardBodySchema = z.object({
  supplierName: z.string().trim().min(1, 'Supplier/Source name is required'),
  billNumber: z.string().trim().optional(),
  billDate: z.string().optional(),
  inwardDate: z.string().optional(),
  notes: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        componentId: objectIdString,
        qty: z.coerce.number().positive('Quantity must be greater than zero'),
        unitRate: z.coerce.number().min(0, 'Unit rate cannot be negative'),
        unitShortCode: z.string().trim().optional(),
        remarks: z.string().trim().optional(),
      })
    )
    .min(1, 'At least one component item is required in the inward entry'),
});
