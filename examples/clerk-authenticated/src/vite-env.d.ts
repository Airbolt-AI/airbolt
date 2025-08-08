/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_AIRBOLT_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
