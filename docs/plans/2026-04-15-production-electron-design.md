# VESPR Production Hardening + Electron Desktop App Design

**Date:** 2026-04-15
**Status:** Approved
**Approach:** Cloud-backed Electron desktop app with direct download first, app stores later

## Architecture

- Electron shell wraps the Next.js frontend
- Backend API stays cloud-hosted (Vercel)
- Neon Postgres remains the shared database
- Real-time sync via Pusher/Ably for instant multi-user updates
- Auto-updater via GitHub Releases

## Phases

### Phase A — Cloud Infrastructure Hardening
- Real-time messaging (Ably — works serverless, cheaper than Pusher at scale)
- Rate limiting (Upstash Redis)
- Background job queue (Inngest — serverless-native)
- Password reset flow (email-based token via Resend)
- Error tracking (Sentry — install actual SDK)
- Health check endpoint
- Security headers (CSP, HSTS, X-Frame-Options)
- Input validation (Zod on critical routes)
- API pagination on list endpoints
- Session revocation support
- Email verification on signup
- Env var validation on startup

### Phase B — Electron Shell
- electron-builder for packaging
- System tray with notification badges
- Native OS notifications
- Auto-updater (electron-updater → GitHub Releases)
- Deep linking (vespr:// protocol)
- Window state persistence
- Mac .dmg + Windows .exe + Linux .AppImage

### Phase C — Desktop-Native Features
- Global keyboard shortcut (Cmd+Shift+V)
- Menu bar quick actions
- Offline indicator
- Local file drag-and-drop uploads
- System idle detection (auto-status)

### Phase D — Production Polish
- Custom 500 error page
- Legal pages (ToS, Privacy)
- Product analytics (PostHog)
- Comprehensive audit logging

### Phase E — Distribution
- Code signing (Apple + Windows)
- Auto-update server
- Download page
- Crash reporting
