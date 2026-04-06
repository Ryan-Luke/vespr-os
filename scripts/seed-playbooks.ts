// Standalone runner for the playbook seeder.
// Usage: set -a && source .env.local && set +a && npx tsx scripts/seed-playbooks.ts
//
// Same logic runs automatically via POST /api/onboarding, so manual runs
// are only needed after a `/reset` without re-onboarding.

import { seedPlaybooks } from "../src/lib/seed-playbooks"

async function main() {
  const inserted = await seedPlaybooks()
  console.log(`Inserted: ${inserted}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
