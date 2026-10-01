/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Carpeta del lector de etiquetas (definida en vite.config.ts). */
declare const __OCR_DIR__: string;
