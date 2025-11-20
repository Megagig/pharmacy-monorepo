/* Global type declarations for the project */

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_APP_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Process environment for Node.js compatibility
declare namespace NodeJS {
  interface ProcessEnv {
    readonly REACT_APP_API_URL: string;
    readonly REACT_APP_STRIPE_PUBLISHABLE_KEY: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};

// User type augmentation for missing properties
declare module '../../types/User' {
  interface User {
    permissions?: string[];
    features?: string[];
    licenseStatus?: 'pending' | 'approved' | 'rejected';
    subscriptionTier?: 'free_trial' | 'basic' | 'pro' | 'enterprise';
    currentSubscription?: SubscriptionDetails;
    stripeCustomerId?: string;
    subscription?: {
      status: 'active' | 'canceled' | 'expired' | 'pending' | 'trial';
      expiresAt: string;
      canceledAt?: string;
      tier?: string;
    };
    role?: 'pharmacist' | 'technician' | 'owner' | 'admin' | 'super_admin';
  }
}

// Interfaces for custom types
interface SubscriptionDetails {
  id: string;
  plan: string;
  status: 'active' | 'canceled' | 'expired' | 'pending' | 'trial';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
}

interface StripeConfirmationResponse {
  paymentMethod?: { id: string };
  error?: { message: string };
}

interface StripeSetupData {
  payment_method?: { card?: unknown; billing_details?: unknown };
  return_url?: string;
}

// Module declarations for missing packages
declare module '@stripe/stripe-js' {
  export function loadStripe(key: string): Promise<StripeInstance>;
  export interface Stripe {
    confirmCardSetup(
      clientSecret: string,
      data?: StripeSetupData
    ): Promise<StripeConfirmationResponse>;
  }
}

interface StripeInstance {
  elements: () => StripeElements;
  confirmCardPayment: (
    clientSecret: string,
    data?: StripeSetupData
  ) => Promise<StripeConfirmationResponse>;
  confirmCardSetup: (
    clientSecret: string,
    data?: StripeSetupData
  ) => Promise<StripeConfirmationResponse>;
}

interface StripeElements {
  getElement: (elementType: string) => StripeElement | null;
}

interface StripeElement {
  on: (event: string, handler: (event: { complete: boolean }) => void) => void;
  update: (options: Record<string, unknown>) => void;
}

interface ElementsProps {
  stripe?: StripeInstance | null;
  options?: { clientSecret?: string; fonts?: Array<{ cssSrc: string }> };
  children: React.ReactNode;
}

interface CardElementProps {
  onChange?: (event: {
    complete: boolean;
    error?: { message: string };
  }) => void;
  options?: { style?: Record<string, unknown>; hidePostalCode?: boolean };
}

declare module '@stripe/react-stripe-js' {
  export const Elements: React.ComponentType<ElementsProps>;
  export const CardElement: React.ComponentType<CardElementProps>;
  export function useStripe(): StripeInstance | null;
  export function useElements(): StripeElements | null;
}

// Fix for MUI Grid component type issues
declare module '@mui/material/Grid' {
  interface GridProps {
    item?: boolean;
    container?: boolean;
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  }
}

// Generic API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Common utility types
export type ErrorWithMessage = {
  message: string;
};

export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

export function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
  if (isErrorWithMessage(maybeError)) return maybeError;

  try {
    return new Error(JSON.stringify(maybeError));
  } catch {
    return new Error(String(maybeError));
  }
}

export function getErrorMessage(error: unknown) {
  return toErrorWithMessage(error).message;
}
