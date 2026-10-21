import { toast } from './toast';
import { UseFormSetError, FieldValues, Path } from 'react-hook-form';

export interface BackendErrorItem {
  path: string;
  message: string;
}

export interface BackendErrorResponse {
  message?: string;
  errors?: BackendErrorItem[];
}

/**
 * Maps backend API errors to React Hook Form field errors when possible,
 * or displays an informative toast notification.
 */
export function handleApiError<TFieldValues extends FieldValues = FieldValues>(
  error: any,
  setError?: UseFormSetError<TFieldValues>,
  defaultMessage = 'An unexpected error occurred. Please try again.'
): string {
  // Check network/offline error
  if (error?.message === 'Network Error' || !error?.response) {
    const netMsg = 'Network connection failed. Please check your internet connection.';
    toast.error(netMsg);
    return netMsg;
  }

  const status = error.response?.status;
  const data: BackendErrorResponse | undefined = error.response?.data;
  const serverMessage = data?.message;

  // Handle 403 Forbidden
  if (status === 403) {
    const msg = serverMessage || 'Permission denied. You do not have permission for this action.';
    toast.error(msg);
    return msg;
  }

  // Handle 401 Unauthorized
  if (status === 401) {
    const msg = serverMessage || 'Invalid credentials or session expired.';
    toast.error(msg);
    return msg;
  }

  // If backend returned structured validation issues from Zod middleware
  if (Array.isArray(data?.errors) && data.errors.length > 0 && setError) {
    let firstMessage = '';
    data.errors.forEach((errItem, idx) => {
      if (errItem.path) {
        // e.g. "items.0.qty" -> "items.0.qty" as Path<TFieldValues>
        const fieldName = errItem.path as Path<TFieldValues>;
        try {
          setError(fieldName, {
            type: 'server',
            message: errItem.message,
          });
        } catch {
          // If path doesn't directly map, ignore silently
        }
      }
      if (idx === 0) {
        firstMessage = errItem.message;
      }
    });

    const displayMsg = firstMessage || serverMessage || defaultMessage;
    toast.error(displayMsg);
    return displayMsg;
  }

  // Map known unique / duplicate conflict messages to specific fields
  if (serverMessage && setError) {
    const lower = serverMessage.toLowerCase();
    if (lower.includes('part code') && lower.includes('already exists')) {
      try {
        setError('partCode' as Path<TFieldValues>, { type: 'server', message: serverMessage });
      } catch {}
    } else if (lower.includes('vendor with name') || (lower.includes('name') && lower.includes('already exists'))) {
      try {
        setError('name' as Path<TFieldValues>, { type: 'server', message: serverMessage });
      } catch {}
    } else if (lower.includes('gst') && lower.includes('already exists')) {
      try {
        setError('gstNumber' as Path<TFieldValues>, { type: 'server', message: serverMessage });
      } catch {}
    } else if (lower.includes('circuit') && lower.includes('already exists')) {
      try {
        setError('circuitCode' as Path<TFieldValues>, { type: 'server', message: serverMessage });
      } catch {}
    } else if (lower.includes('email') && (lower.includes('invalid') || lower.includes('already exists'))) {
      try {
        setError('email' as Path<TFieldValues>, { type: 'server', message: serverMessage });
      } catch {}
    }
  }

  const finalMsg = serverMessage || defaultMessage;
  toast.error(finalMsg);
  return finalMsg;
}

export function getApiErrorMessage(error: any, defaultMessage = 'An unexpected error occurred'): string {
  if (error?.message === 'Network Error' || !error?.response) {
    return 'Network connection failed. Please check your internet connection.';
  }
  return error?.response?.data?.message || defaultMessage;
}

export function applyServerValidationErrors<TFieldValues extends FieldValues = FieldValues>(
  error: any,
  setError?: UseFormSetError<TFieldValues>
): boolean {
  if (!setError) return false;
  const data = error?.response?.data;
  let matched = false;
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    data.errors.forEach((errItem: any) => {
      if (errItem.path) {
        try {
          setError(errItem.path as Path<TFieldValues>, {
            type: 'server',
            message: errItem.message,
          });
          matched = true;
        } catch {}
      }
    });
  }
  const serverMessage = data?.message;
  if (serverMessage) {
    const lower = serverMessage.toLowerCase();
    if (lower.includes('name') && (lower.includes('already exists') || lower.includes('duplicate'))) {
      try {
        setError('name' as Path<TFieldValues>, { type: 'server', message: serverMessage });
        matched = true;
      } catch {}
    } else if (lower.includes('code') && (lower.includes('already exists') || lower.includes('duplicate'))) {
      try {
        setError('shortCode' as Path<TFieldValues>, { type: 'server', message: serverMessage });
        matched = true;
      } catch {}
    }
  }
  return matched;
}
