import toast from 'react-hot-toast';

/**
 * Show a success toast notification
 */
export const showSuccessToast = (message: string, options?: any) => {
  return toast.success(message, {
    duration: 4000,
    position: 'top-right',
    ...options,
  });
};

/**
 * Show an error toast notification
 */
export const showErrorToast = (message: string, options?: any) => {
  return toast.error(message, {
    duration: 5000,
    position: 'top-right',
    ...options,
  });
};

/**
 * Show an info toast notification
 */
export const showInfoToast = (message: string, options?: any) => {
  return toast(message, {
    duration: 4000,
    position: 'top-right',
    icon: 'ℹ️',
    ...options,
  });
};

/**
 * Show a warning toast notification
 */
export const showWarningToast = (message: string, options?: any) => {
  return toast(message, {
    duration: 4000,
    position: 'top-right',
    icon: '⚠️',
    ...options,
  });
};

/**
 * Show a loading toast notification
 */
export const showLoadingToast = (message: string, options?: any) => {
  return toast.loading(message, {
    position: 'top-right',
    ...options,
  });
};

/**
 * Dismiss a specific toast
 */
export const dismissToast = (toastId: string) => {
  return toast.dismiss(toastId);
};

/**
 * Dismiss all toasts
 */
export const dismissAllToasts = () => {
  return toast.dismiss();
};

/**
 * Show a promise toast (loading -> success/error)
 */
export const showPromiseToast = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: any) => string);
  },
  options?: any
) => {
  return toast.promise(promise, messages, {
    position: 'top-right',
    ...options,
  });
};

export default {
  success: showSuccessToast,
  error: showErrorToast,
  info: showInfoToast,
  warning: showWarningToast,
  loading: showLoadingToast,
  dismiss: dismissToast,
  dismissAll: dismissAllToasts,
  promise: showPromiseToast,
};