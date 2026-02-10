const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

const OPTIONAL_ENV_WARNING_VARS = [
  'OPENAI_API_KEY',
  'MASSIVE_API_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
] as const

interface EnvValidationResult {
  missingRequired: string[]
  warnings: string[]
}

export function validateEnv(): EnvValidationResult {
  const missingRequired = REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name]
    return typeof value !== 'string' || value.trim().length === 0
  })

  const warnings = OPTIONAL_ENV_WARNING_VARS
    .filter((name) => {
      const value = process.env[name]
      return typeof value !== 'string' || value.trim().length === 0
    })
    .map((name) => `Optional environment variable is not set: ${name}`)

  for (const warning of warnings) {
    console.warn(`[env-validation] ${warning}`)
  }

  if (missingRequired.length > 0) {
    throw new Error(`Missing required environment variables: ${missingRequired.join(', ')}`)
  }

  return {
    missingRequired,
    warnings,
  }
}
