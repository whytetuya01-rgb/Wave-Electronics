import { z } from 'zod';

/**
 * Wave Electronics Zod Validation Schemas
 * Source of truth matching backend schemas and business rules.
 */

// GSTIN Regex (15 alphanumeric characters: 2 state digits, 10 PAN, 1 entity, 1 'Z', 1 checksum)
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(100, 'Name must be under 100 characters'),
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(72, 'Password must be under 72 characters'),
  role: z.enum(['admin', 'store_keeper', 'production'], {
    errorMap: () => ({ message: 'Please select a role' }),
  }),
});
export type CreateUserFormData = z.infer<typeof createUserSchema>;

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(72, 'Password must be under 72 characters'),
});
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const componentSchema = z.object({
  partCode: z
    .string()
    .trim()
    .min(1, 'Part code is required')
    .max(50, 'Part code must be under 50 characters'),
  name: z
    .string()
    .trim()
    .min(1, 'Component name is required')
    .max(120, 'Component name must be under 120 characters'),
  categoryId: z
    .string()
    .min(1, 'Please select a category'),
  unitId: z
    .string()
    .min(1, 'Please select a unit of measurement'),
  locationId: z
    .string()
    .optional(),
  package: z
    .string()
    .trim()
    .optional(),
  openingStock: z.coerce
    .number({ invalid_type_error: 'Opening stock must be a number' })
    .min(0, 'Opening stock cannot be negative')
    .default(0),
  minStock: z.coerce
    .number({ invalid_type_error: 'Minimum stock must be a number' })
    .min(0, 'Minimum stock cannot be negative')
    .default(0),
  ratePerUnit: z.coerce
    .number({ invalid_type_error: 'Unit purchase rate must be a number' })
    .min(0, 'Unit purchase rate cannot be negative')
    .default(0),
});
export type ComponentFormData = z.infer<typeof componentSchema>;

export const stockAdjustmentSchema = z.object({
  qtyChange: z.coerce
    .number({ invalid_type_error: 'Adjustment quantity is required' })
    .refine((val) => val !== 0, 'Adjustment quantity cannot be zero'),
  reason: z
    .string()
    .min(1, 'Audit reason is required'),
  notes: z
    .string()
    .trim()
    .optional(),
});
export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>;

export const vendorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Company name is required')
    .max(120, 'Company name is too long'),
  contactPerson: z
    .string()
    .trim()
    .min(1, 'Contact person is required'),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .refine((val) => PHONE_REGEX.test(val), 'Please enter a valid phone number'),
  email: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.string().email().safeParse(val).success, {
      message: 'Please enter a valid email address',
    }),
  gstNumber: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || GSTIN_REGEX.test(val.toUpperCase()), {
      message: 'Enter a valid 15-character GSTIN (e.g. 27AABCA1234F1Z5)',
    }),
  city: z
    .string()
    .trim()
    .min(1, 'City is required'),
  state: z
    .string()
    .trim()
    .default('Maharashtra'),
  address: z
    .string()
    .trim()
    .optional(),
  defaultJobWorkRate: z.coerce
    .number({ invalid_type_error: 'Job work rate must be a number' })
    .min(0, 'Job work rate cannot be negative')
    .default(0),
  circuitsCanAssemble: z
    .string()
    .optional(),
  remarks: z
    .string()
    .trim()
    .optional(),
});
export type VendorFormData = z.infer<typeof vendorSchema>;

export const stockInwardItemSchema = z.object({
  componentId: z
    .string()
    .min(1, 'Component selection is required'),
  qty: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .positive('Quantity must be greater than zero'),
  unitRate: z.coerce
    .number({ invalid_type_error: 'Rate must be a number' })
    .min(0, 'Unit rate cannot be negative'),
  unitShortCode: z.string().optional(),
  remarks: z.string().optional(),
});

export const stockInwardSchema = z.object({
  supplierName: z
    .string()
    .trim()
    .min(1, 'Supplier / Source name is required'),
  billNumber: z
    .string()
    .trim()
    .optional(),
  billDate: z
    .string()
    .optional(),
  inwardDate: z
    .string()
    .min(1, 'Inward date is required'),
  notes: z
    .string()
    .trim()
    .optional(),
  items: z
    .array(stockInwardItemSchema)
    .min(1, 'At least one component item is required in the inward entry')
    .refine(
      (items) => {
        const ids = items.map((i) => i.componentId).filter(Boolean);
        return new Set(ids).size === ids.length;
      },
      {
        message: 'This component is already added. Consolidate quantity into one row.',
      }
    ),
});
export type StockInwardFormData = z.infer<typeof stockInwardSchema>;

export const circuitBomItemSchema = z.object({
  componentId: z
    .string()
    .min(1, 'Component selection is required'),
  qtyPerUnit: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .positive('Quantity per circuit must be greater than zero'),
  designator: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export const circuitSchema = z.object({
  circuitCode: z
    .string()
    .trim()
    .min(1, 'Circuit code is required')
    .max(50, 'Circuit code is too long'),
  name: z
    .string()
    .trim()
    .min(1, 'Circuit name is required')
    .max(120, 'Circuit name is too long'),
  version: z
    .string()
    .trim()
    .min(1, 'Version is required')
    .default('1.0'),
  description: z
    .string()
    .trim()
    .optional(),
  bomItems: z
    .array(circuitBomItemSchema)
    .min(1, 'At least one BOM component is required')
    .refine(
      (items) => {
        const ids = items.map((i) => i.componentId).filter(Boolean);
        return new Set(ids).size === ids.length;
      },
      {
        message: 'This component is already in the BOM — duplicate components are not permitted',
      }
    ),
});
export type CircuitFormData = z.infer<typeof circuitSchema>;

export const jobCircuitRowSchema = z.object({
  circuitId: z
    .string()
    .min(1, 'Select a circuit to continue'),
  orderedQty: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Ordered quantity must be a whole number')
    .positive('Ordered quantity must be greater than zero'),
});

export const jobFormSchema = z.object({
  vendorId: z
    .string()
    .min(1, 'Select a vendor to continue'),
  targetDate: z
    .string({ required_error: 'Target completion date is required' })
    .min(1, 'Target completion date is required'),
  remarks: z
    .string()
    .trim()
    .optional(),
  jobCircuits: z
    .array(jobCircuitRowSchema)
    .min(1, 'At least one circuit is required for a job')
    .refine(
      (rows) => {
        const ids = rows.map((r) => r.circuitId).filter(Boolean);
        return new Set(ids).size === ids.length;
      },
      {
        message: 'Duplicate circuit selection: a job cannot include the same circuit version twice',
      }
    ),
});
export type JobFormData = z.infer<typeof jobFormSchema>;

export const masterCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name is required')
    .max(80, 'Category name is too long'),
  description: z
    .string()
    .trim()
    .optional(),
});

export const masterUnitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Unit name is required')
    .max(60, 'Unit name is too long'),
  shortCode: z
    .string()
    .trim()
    .min(1, 'Short code is required (e.g. NOS, MTR, KG)')
    .max(10, 'Short code is too long'),
});

export const masterLocationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Location name is required')
    .max(80, 'Location name is too long'),
  zone: z
    .string()
    .trim()
    .optional(),
  description: z
    .string()
    .trim()
    .optional(),
});
