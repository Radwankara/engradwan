/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORE_WHATSAPP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
