/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUDIT_GAS_URL?: string;
  readonly VITE_ORDERING_GAS_URL?: string;
  readonly VITE_AUDIT_GOOGLE_SHEET_URL?: string;
  // 다른 환경 변수들...
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

