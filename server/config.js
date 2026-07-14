const required = (name, value) => {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export function infrastructureConfig(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  const production = env.NODE_ENV === 'production' || Boolean(env.VERCEL_ENV);

  return Object.freeze({
    production,
    appOrigin: env.APP_ORIGIN || env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.APP_ORIGIN || env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:5173',
    sessionSecret: env.SESSION_SECRET || (production ? '' : 'mirror-cartographer-local-development-secret'),
    supabase: {
      enabled: Boolean(supabaseUrl && serviceRoleKey),
      url: supabaseUrl.replace(/\/$/, ''),
      serviceRoleKey,
      anonKey,
      bucket: env.SUPABASE_STORAGE_BUCKET || 'mirror-cartographer-private',
    },
    payments: {
      koFi: env.KOFI_URL || 'https://ko-fi.com/mirrorcartographer/commissions',
      sponsor: env.SPONSOR_URL || '',
      consultation: env.CONSULTATION_URL || '',
    },
    limits: {
      jsonBytes: Number(env.MAX_JSON_BYTES || 1_000_000),
      uploadBytes: Number(env.MAX_UPLOAD_BYTES || 25_000_000),
      listPageSize: Number(env.LIST_PAGE_SIZE || 100),
    },
  });
}

export function assertProductionConfig(config) {
  if (!config.production) return;
  required('SESSION_SECRET', config.sessionSecret);
  if (!config.supabase.enabled) {
    throw new Error('Production persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
}
