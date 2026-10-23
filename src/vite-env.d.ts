interface ImportMeta {
  readonly env: Record<string, unknown> & {
    VITE_SUPABASE_AUTH_BOOTSTRAP?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  };
}
