/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_APP_NAME: string;
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly NODE_ENV: string;
  // add more env variables as needed
  [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// For Node.js process.env compatibility in some components
declare namespace NodeJS {
  interface ProcessEnv {
    readonly REACT_APP_API_URL: string;
    readonly REACT_APP_STRIPE_PUBLISHABLE_KEY: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
