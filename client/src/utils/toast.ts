import { toast as sonnerToast, ExternalToast } from 'sonner';

/**
 * Wave Electronics Enterprise SaaS Global Toast Helper
 * Follows the Black, White & Golden Grey theme.
 * All notifications have appropriate durations, accessible contrast,
 * and high z-index above modal backdrops.
 */

export const toast = {
  success: (message: string, options?: ExternalToast) => {
    return sonnerToast.success(message, {
      duration: 3500,
      ...options,
    });
  },

  error: (message: string, options?: ExternalToast) => {
    return sonnerToast.error(message, {
      duration: 6000,
      ...options,
    });
  },

  warning: (message: string, options?: ExternalToast) => {
    return sonnerToast.warning(message, {
      duration: 5000,
      ...options,
    });
  },

  info: (message: string, options?: ExternalToast) => {
    return sonnerToast.info(message, {
      duration: 3500,
      ...options,
    });
  },

  loading: (message: string, options?: ExternalToast) => {
    return sonnerToast.loading(message, {
      ...options,
    });
  },

  promise: <T>(
    promise: Promise<T>,
    data: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options?: ExternalToast
  ) => {
    return sonnerToast.promise(promise, {
      ...data,
      ...options,
    });
  },

  dismiss: (id?: string | number) => {
    return sonnerToast.dismiss(id);
  },
};

export default toast;
