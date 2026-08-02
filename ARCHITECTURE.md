# an-telephony-tools — Architecture

Open-source, self-hosted toolset covering the core functions of CallHub: call-center calling,
voice broadcasting, and P2P texting. Built modularly so each feature can ship independently on
top of a shared core.

## v0.1 scope

- **Deployment model**: single organization per deployment, self-hosted (Docker Compose).
  Multi-user within the org (`admin`, `campaign_manager`, `agent` roles), not multi-tenant.
- **Stack**: Node.js + TypeScript monorepo (npm workspaces), PostgreSQL, Redis, Fastify API,
  Next.js frontend.
- **First feature module**: P2P texting. Voice broadcasting and call center follow as sibling
  packages once the shared core (contacts, lists, opt-outs, telephony abstraction, Action
  Network sync) is proven out.
- **Region**: Canada. Twilio long-code SMS for P2P texting (no pre-provisioning needed, fits
  low-volume conversational sending). Toll-free/short code are noted for later — needed once
  voice broadcasting does bulk one-to-many sending, since Canadian carriers filter A2P traffic
  more aggressively on long codes at scale.

## 1. Common infrastructure

### Auth & orgs
Email/password + sessions. Three roles gate what a user can do: `admin` (org settings, AN
integration, user management), `campaign_manager` (create/run campaigns), `agent` (work the
queue). No SSO/OAuth in v0.1.

### Contacts & lists
- `contacts`: E.164 phone (unique), name, `custom_fields` (JSONB) for arbitrary AN/CRM fields,
  `source` (manual/csv/action_network), `action_network_id` for round-tripping.
- `lists`: static (CSV-imported) or dynamic (saved filter, matching Action Network's model).
- `list_memberships`: many-to-many so a contact can belong to multiple campaigns without
  duplication.
- `opt_outs`: phone + channel (sms/voice), permanent, org-wide. Checked before every send —
  this is the compliance backbone and is deliberately decoupled from any single campaign so it
  still protects contacts once voice modules exist.

### Telephony abstraction
A `TelephonyProvider` interface (`sendSms` today; `makeCall`/`startBroadcast` land with later
modules) with a Twilio implementation behind it. Keeps provider-specific code out of campaign
logic so voice broadcasting and call center reuse it, and so swapping providers later doesn't
touch business logic.

Canada specifics that shaped the design (confirmed against Twilio's CA SMS guidelines):
- Long code numbers: no pre-provisioning, correct fit for agent-paced P2P sending.
- Toll-free requires verification; short codes take 12–16 weeks — deferred to the voice
  broadcasting module.
- Segment limits: 136 chars GSM-7 / 70 chars UCS-2 — the agent UI should show a live counter.
- Inbound webhook mirrors STOP/START into our own `opt_outs` table rather than relying solely
  on carrier/Twilio-level handling, so opt-outs are enforced even if the provider changes.

### Action Network integration
- Auth: `OSDI-API-Token` header.
- Rate limit: 4 req/s, enforced client-side with backoff (see `packages/integrations/action-network`).
- **Pull**: scheduled job querying `/people` with `modified_date` (oData) filters — delta sync,
  not full pulls.
- **Push**: Person Signup Helper endpoint to write new/updated people and subscription status.
- **Webhooks**: subscribe to AN's outbound webhooks (near-real-time, ~5 min latency ceiling)
  where the org's plan supports it, instead of tight polling.
- Field mapping (AN custom fields ↔ `contacts.custom_fields`) is configurable per-org, not
  hardcoded — every AN instance has different custom fields.

### Compliance (Canada)
- CASL requires consent for commercial electronic messages: every contact carries
  `consent_source` + timestamp; sends are blocked without it unless a list is explicitly
  imported as pre-verified/opted-in.
- National DNCL applies to telemarketing calls, not SMS — not load-bearing for v0.1, but the
  `opt_outs`/consent model is built generically now so voice broadcasting and call center can
  extend it without a data-model rework.
- Configurable quiet hours (default: no sends outside local daytime per contact's time zone,
  where known).

## 2. P2P texting module (v0.1 feature)

- **Campaigns**: a list + a set of message templates + an assigned pool of agents.
- **Queue distribution**: server-side atomic assignment (`SELECT ... FOR UPDATE SKIP LOCKED`)
  so two agents never get the same contact — this is the one feature CallHub calls out as core
  to the product, so it's the centerpiece of `packages/p2p-texting`.
- **Agent UI**: one-contact-at-a-time send screen, canned-response templates, character
  counter, skip/no-response, MMS attach.
- **Inbound handling**: replies route back to the assigning agent; unassigned/STOP messages go
  to a shared inbox.
- **Reporting**: sent/delivered/replied/opted-out counts per campaign.

Out of scope for v0.1: link shortening/tracking, MMS click analytics, CRM integrations beyond
Action Network, short-code/toll-free provisioning, send throttling beyond basic queueing.

## 3. Repo structure

```
/apps
  /web          – Next.js frontend (agent UI + admin)
  /api          – Fastify backend, Twilio webhooks
/packages
  /core         – db schema (Drizzle), contacts, lists, opt-outs, auth types
  /telephony    – TelephonyProvider interface + Twilio adapter
  /integrations/action-network – AN API client + sync jobs
  /p2p-texting  – queue assignment + campaign domain logic
/infra          – docker-compose (Postgres + Redis), env templates
```

`voice-broadcasting` and `call-center` will land as new sibling packages under `/packages`,
reusing `core` and `telephony` rather than forking them.

## 4. Roadmap after v0.1

1. **Voice broadcasting**: `TelephonyProvider.startBroadcast`, TwiML IVR ("press 1 to
   connect"), scheduler, toll-free number verification flow.
2. **Call center**: browser softphone via Twilio Voice SDK, live call queues, dispositions,
   real-time agent presence — the most complex module, deferred until the shared core is
   battle-tested by the first two.
3. Multi-tenant support, if/when the project needs to host more than one org per deployment.
