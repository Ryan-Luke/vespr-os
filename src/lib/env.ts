export function validateEnv() {
  const required = ["DATABASE_URL", "AUTH_SECRET", "INTEGRATION_ENCRYPTION_KEY"]
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 16) {
    throw new Error("AUTH_SECRET must be at least 16 characters")
  }
}
