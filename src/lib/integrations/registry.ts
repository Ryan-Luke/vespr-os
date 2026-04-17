// Provider registry for the integration adapter layer (BLA-88).
//
// Each entry declares what credentials the provider needs so the picker
// UI can render the right form fields. Only simple API-key-style auth is
// supported in this chunk. OAuth providers (Google Sheets, QuickBooks,
// Calendly v2, Notion modern) are deferred to a future chunk.
//
// Naming convention: provider_key is a lowercase slug with no spaces.
// It must match the display name users see in the phase integration
// suggestions (via normalizeProviderKey).

export type CredentialFieldType = "text" | "password" | "url" | "select"

export interface CredentialField {
  key: string
  label: string
  type: CredentialFieldType
  placeholder?: string
  required: boolean
  help?: string
  options?: { value: string; label: string }[]
}

export interface IntegrationProvider {
  key: string              // "gohighlevel"
  name: string             // "GoHighLevel"
  category: "crm" | "email" | "payments" | "marketing" | "delivery" | "dashboards" | "content" | "calendar" | "analytics" | "pm"
  authType: "api_key" | "api_key_multi" | "oauth" | "none"
  fields: CredentialField[]
  docsUrl?: string
}

export const PROVIDERS: IntegrationProvider[] = [
  // ── CRM / Sales ─────────────────────────────────────────
  {
    key: "gohighlevel",
    name: "GoHighLevel",
    category: "crm",
    authType: "api_key_multi",
    fields: [
      { key: "api_key", label: "Private Integration Token", type: "password", required: true, help: "Settings → Integrations → Private Integrations → Create new token (v2 API, not the legacy API Key)" },
      { key: "location_id", label: "Location ID", type: "text", required: true, help: "Settings → Business Profile → bottom of page" },
    ],
  },
  {
    key: "hubspot",
    name: "HubSpot",
    category: "crm",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "Private App Access Token", type: "password", required: true, help: "Settings → Integrations → Private Apps" },
    ],
  },
  {
    key: "pipedrive",
    name: "Pipedrive",
    category: "crm",
    authType: "api_key_multi",
    fields: [
      { key: "api_token", label: "API Token", type: "password", required: true, help: "Settings → Personal → API" },
      { key: "company_domain", label: "Company Domain", type: "text", required: true, placeholder: "yourcompany", help: "The subdomain part of yourcompany.pipedrive.com" },
    ],
  },
  {
    key: "attio",
    name: "Attio",
    category: "crm",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true, help: "Workspace Settings → API" },
    ],
  },

  // ── Email / Marketing ──────────────────────────────────
  {
    key: "mailchimp",
    name: "Mailchimp",
    category: "email",
    authType: "api_key_multi",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true, help: "Account → Extras → API Keys" },
      { key: "server_prefix", label: "Server Prefix", type: "text", required: true, placeholder: "us14", help: "The prefix in your API key after the dash, e.g. us14" },
    ],
  },
  {
    key: "activecampaign",
    name: "ActiveCampaign",
    category: "email",
    authType: "api_key_multi",
    fields: [
      { key: "api_url", label: "API URL", type: "url", required: true, placeholder: "https://youraccount.api-us1.com", help: "Settings → Developer" },
      { key: "api_key", label: "API Key", type: "password", required: true },
    ],
  },
  {
    key: "convertkit",
    name: "ConvertKit",
    category: "email",
    authType: "api_key_multi",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "api_secret", label: "API Secret", type: "password", required: true, help: "Account → Advanced → API" },
    ],
  },

  // ── Payments ───────────────────────────────────────────
  {
    key: "stripe",
    name: "Stripe",
    category: "payments",
    authType: "api_key",
    fields: [
      { key: "secret_key", label: "Secret Key", type: "password", required: true, placeholder: "sk_live_... or sk_test_...", help: "Developers → API Keys" },
    ],
  },

  // ── Project Management ──────────────────────────────────
  {
    key: "clickup",
    name: "ClickUp",
    category: "pm",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "Personal API Token", type: "password", required: true, help: "Settings → Apps" },
    ],
  },
  {
    key: "linear",
    name: "Linear",
    category: "pm",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "Personal API Key", type: "password", required: true, placeholder: "lin_api_...", help: "Settings → API" },
    ],
  },

  // ── Email (Transactional) ──────────────────────────────
  {
    key: "resend",
    name: "Resend",
    category: "email",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true, help: "Resend Dashboard -> API Keys -> Create API Key" },
    ],
    docsUrl: "https://resend.com/docs/api-reference/introduction",
  },
  {
    key: "sendgrid",
    name: "SendGrid",
    category: "email",
    authType: "api_key_multi",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true, help: "Settings -> API Keys -> Create API Key (full access or mail send)" },
      { key: "from_email", label: "Verified Sender Email", type: "text", required: true, placeholder: "you@yourdomain.com", help: "Must be a verified sender in SendGrid" },
    ],
    docsUrl: "https://docs.sendgrid.com/api-reference/mail-send/mail-send",
  },

  // ── Calendar ─────────────────────────────────────────────
  {
    key: "calcom",
    name: "Cal.com",
    category: "calendar",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true, help: "Settings -> Developer -> API Keys -> Create" },
    ],
    docsUrl: "https://cal.com/docs/enterprise-features/api",
  },

  // ── Project Management (additional) ─────────────────────
  {
    key: "asana",
    name: "Asana",
    category: "pm",
    authType: "api_key_multi",
    fields: [
      { key: "api_key", label: "Personal Access Token", type: "password", required: true, help: "My Settings -> Apps -> Personal access tokens -> Create new token" },
      { key: "workspace_gid", label: "Workspace GID", type: "text", required: true, help: "From URL: app.asana.com/0/{workspace_gid}/..." },
    ],
    docsUrl: "https://developers.asana.com/reference/rest-api-reference",
  },

  // ── Social & Marketing ─────────────────────────────────
  {
    key: "buffer",
    name: "Buffer",
    category: "marketing",
    authType: "api_key",
    fields: [
      { key: "access_token", label: "Access Token", type: "password", required: true, help: "Buffer developer settings" },
    ],
  },
  {
    key: "notion",
    name: "Notion",
    category: "content",
    authType: "api_key",
    fields: [
      { key: "api_key", label: "Internal Integration Token", type: "password", required: true, help: "Settings -> Connections -> Develop or manage integrations -> Create new integration -> Internal -> copy token" },
    ],
    docsUrl: "https://developers.notion.com/docs/getting-started",
  },

  // ── Analytics ────────────────────────────────────────────
  {
    key: "posthog",
    name: "PostHog",
    category: "analytics",
    authType: "api_key_multi",
    fields: [
      { key: "api_key", label: "Personal API Key", type: "password", required: true, help: "Settings -> Personal API Keys -> Create personal API key" },
      { key: "project_id", label: "Project ID", type: "text", required: true, help: "Settings -> Project -> Project API Key (the numeric project ID)" },
      { key: "host", label: "PostHog Host", type: "url", required: false, placeholder: "https://app.posthog.com", help: "Leave blank for PostHog Cloud. For self-hosted, enter your instance URL." },
    ],
    docsUrl: "https://posthog.com/docs/api",
  },

  // ── Dashboards ─────────────────────────────────────────
  {
    key: "databox",
    name: "Databox",
    category: "dashboards",
    authType: "api_key",
    fields: [
      { key: "api_token", label: "Push Token", type: "password", required: true, help: "Settings → Data Sources → Push API" },
    ],
  },
]

/**
 * Normalize a human-readable tool name from the phase suggestions into a
 * provider key we can look up in the registry. Returns null if the name
 * isn't a known registry provider (caller should fall through to plain
 * text capture).
 */
export function normalizeProviderKey(name: string): string | null {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "")
  const aliases: Record<string, string> = {
    gohighlevel: "gohighlevel",
    ghl: "gohighlevel",
    hubspot: "hubspot",
    pipedrive: "pipedrive",
    attio: "attio",
    mailchimp: "mailchimp",
    activecampaign: "activecampaign",
    convertkit: "convertkit",
    resend: "resend",
    sendgrid: "sendgrid",
    stripe: "stripe",
    clickup: "clickup",
    linear: "linear",
    asana: "asana",
    calcom: "calcom",
    cal: "calcom",
    buffer: "buffer",
    notion: "notion",
    posthog: "posthog",
    databox: "databox",
  }
  return aliases[slug] ?? null
}

export function getProvider(key: string): IntegrationProvider | null {
  return PROVIDERS.find((p) => p.key === key) ?? null
}
