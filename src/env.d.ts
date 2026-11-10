interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
  readonly BASE_URL: string
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_GEMINI_LIVE_MODEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css'
