# Terms of Service and Privacy Notice — Pawstia PMS (PS01)

**English draft · Product: Pawstia PMS (internal project identity: PawSpace / PS01) · Operator: WSTERA**

---

> ## ⚠️ DOCUMENT STATUS — DRAFT (read before use)
>
> - This document is a **DRAFT for review only**.
> - It is **NOT legal advice** and does not replace the opinion of a qualified lawyer.
> - **The final text requires Owner approval before it takes effect.**
> - **NO production use yet.**
> - Every statement about "the system" is written from the real code in this repository at revision `c5980eb`, with the source file named after the statement.
> - Every undecided point uses the same marker `[[OWNER INPUT: OI-nn]]` and is collected in `docs/legal/PS01-OWNER-INPUTS.md`.

---

## 1. Roles and Lawful Basis for Processing

To align with the Thai Personal Data Protection Act B.E. 2562 (PDPA):

1.1 **The shop (pet hotel / boarding / pet daycare) is the DATA CONTROLLER.** The shop decides the purposes and means of processing its own customers' data, and the shop is responsible for having a suitable lawful basis for each processing activity.

1.2 **The shop has its own duty towards the pet owner.** The shop must inform the pet owner and/or obtain the pet owner's consent under whichever lawful basis the shop relies on (for example consent, performance of a contract, or legitimate interest) before the shop records the pet owner's data in the system, and before the shop sends the daily report to the pet owner on LINE. WSTERA does not obtain that consent on the shop's behalf and does not take over that duty.

1.3 **WSTERA is the DATA PROCESSOR.** WSTERA processes, stores and passes on data only on the shop's instructions, and does not use the shop's data for its own purposes. The legal entity acting as operator is `[[OWNER INPUT: OI-01]]`.

1.4 This document is not a complete data processing agreement (DPA) between the shop and WSTERA. Any DPA is a separate document that must be prepared and approved before production use.

---

## 2. What Data Is Processed and Why

The system processes the following categories of personal data:

2.1 **Shop staff accounts** — name, email, role (owner / manager / staff) and active status. Authentication uses Supabase Auth with email and password. The system reads a staff member's context through an RPC function and removes access immediately when the staff member is deactivated.
`[src: docs/PRD.md:142] [src: lib/tenant-context.ts:41-43] [src: supabase/migrations/20260820030000_phase3_auth_tenant.sql:63-72]`

2.2 **Pet owner contact details** — first name, last name, phone number, emergency phone, address, and the owner's LINE identifier once linked.
`[src: supabase/migrations/20260220000000_initial_schema.sql:38-55]`

2.3 **Pet records** — name, species, breed, gender, birth date, weight, special care notes and allergy information.
`[src: supabase/migrations/20260220000000_initial_schema.sql:57-63] [src: lib/google-sync-source.ts:16-18]`

2.4 **Booking history** — bookings, room, check-in and check-out dates, amount, booking status, special requests, and customer-submitted booking requests made through LINE.
`[src: supabase/migrations/20260220000000_initial_schema.sql:101] [src: supabase/migrations/20260822000000_phase11_customer_booking_requests.sql:6-26]`

2.5 **Daily report content and photos** — the report date, food / excretion / mood status, the note written by staff, and 1 to 4 photos per report.
`[src: supabase/migrations/20260220000000_initial_schema.sql:139-159] [src: lib/daily-report-media.ts:4]`

2.6 **Necessary technical logs** — application errors, database failures, failed LINE deliveries, failed Google Sheets syncs, failed uploads and failed authentications, kept for security and troubleshooting. The system's logger is designed to redact sensitive values before writing.
`[src: docs/PRODUCTION_OPERATIONS.md:32-39] [src: lib/logger.ts:1-35]`

2.7 **Visitor camera module (only if the shop enables it)** — the system has a separate visitor camera module that keeps an append-only access audit and stores the requester's IP address as a keyed hash, not as a raw address.
`[src: supabase/migrations/20260821150000_phase8_camera_access.sql:39-46] [src: lib/camera-access-core.ts:49-51]`

2.8 **Why we process it** — (a) to provide the service under the contract with the shop (staff accounts, rooms, bookings, daily reports, delivery of reports to the pet owner); (b) to meet legal obligations (accounting and tax records, for which the shop is primarily responsible); (c) for the legitimate interests of the shop and the operator (system security, fraud prevention); and (d) consent, only where the shop relies on consent as the basis for sending reports or communicating with the pet owner.

2.9 **This system has no analytics, advertising or behaviour-tracking capability.** There is no third-party advertising, no tracking pixel, and no sale of data to anyone.
`[src: docs/TERMS_AND_PRIVACY.md:20]` (the zero-data-selling policy statement) — the absence of analytics tooling is the result of a code inspection, not an assertion of a capability: **see the inspection evidence in the work note `docs/house-swarm-5a/WU3-LEGAL-BILINGUAL.md`**

---

## 3. Data Ownership

3.1 The pet owner and pet data, booking data, history and daily report photos recorded through the system **belong to the shop**, not to WSTERA.

3.2 WSTERA **does not sell, rent, publish to unrelated third parties, or use the shop's data for its own marketing.** WSTERA may disclose data only as far as necessary to the sub-processors listed in section 5.

3.3 Pet owners must contact the shop to exercise their rights as data subjects, because the shop is the controller (see section 7).

---

## 4. The System That Actually Exists, and Where Data Lives

This document describes the system that is actually built in this repository, not a system imagined for the future.

4.1 **Database, authentication and storage** — the system uses Supabase for its PostgreSQL database, for authentication, and for file storage.
`[src: docs/SYSTEM_ARCHITECTURE.md:29-32] [src: docs/PRD.md:142]`

4.2 **Daily report delivery on LINE** — the daily report with photos is delivered to the pet owner through the LINE Messaging API (push message) as a Flex message card, using a retry key to avoid duplicate messages.
`[src: lib/line-transport.ts:1] [src: lib/line-transport.ts:40] [src: lib/line-worker.ts:94]`

4.3 **The pet owner's LINE link** — linking the pet owner's LINE account uses LINE Login through LIFF in the pet owner's browser, which then sends an identity token for verification on the server. The system issues a single-use claim link with a limited lifetime and stores only the hash of that link, never the link itself.
`[src: app/line/claim/LineClaimClient.tsx:44-50] [src: app/line/claim/page.tsx:18] [src: lib/line-claim-server.ts:9-13] [src: supabase/migrations/20260820221500_phase5_line_claim.sql:31-32]`

4.4 **The Google Sheets export is a replica the shop itself initiates** — Google Sheets sync is a **one-way export replica** into the shop's own Google account, and the shop must bind its own sheet using a proof token. The replica covers only pet-centric customer and booking data. **It does not cover the photo files in storage and does not cover deep daily report data.**
`[src: docs/PRD.md:28] [src: docs/SYSTEM_ARCHITECTURE.md:37] [src: lib/google-sheet-binding-core.ts:15-30] [src: lib/google-sync-source.ts:11-49]`

4.5 **Where daily report photos live** — daily report photos are stored in the `daily-report-photos` bucket, which is configured as **public for reading**, and are addressed by links whose paths are unguessable (built from the shop id, booking id, pet id, idempotency key and a file content hash).
**The trade-off, stated honestly:** because the bucket is public, anyone holding the full URL of a photo can open it without signing in, and the system itself does not use time-limited URLs. The protection relies only on the path being unguessable. Moving to signed, expiring URLs would affect how photos render in the LINE message card and is a decision for the Owner.
`[src: supabase/migrations/20260820233000_phase6_daily_report_line_delivery.sql:10-22] [src: lib/daily-report-storage.ts:4] [src: lib/daily-report-storage.ts:26-33] [src: lib/daily-report-storage.ts:70] [src: docs/TERMS_AND_PRIVACY.md:47]`

4.6 **Tenant separation between shops** — each shop's data is separated by Supabase Row-Level Security: every core business table has RLS enabled and its read policies are bound to the authenticated user's shop id. The browser can read through RLS but has no general INSERT/UPDATE/DELETE on the core business tables; changes must go through RPC functions or server services that set the tenant, role and invariants themselves. The service role is available only to trusted server and worker paths. The system's existing documents call this structure two-tier RLS, which is a documentation label rather than a separate mechanism.
`[src: supabase/migrations/20260820020000_phase2_authoritative_gateways.sql:909-934] [src: docs/SYSTEM_ARCHITECTURE.md:65] [src: docs/SYSTEM_ARCHITECTURE.md:80] [src: docs/TERMS_AND_PRIVACY.md:45]`

4.7 **Per-shop LINE tokens** — the LINE channel access token for each shop is read from **server-only environment configuration** (`LINE_CHANNEL_ACCESS_TOKENS_JSON`, a JSON keyed by shop id) and is never sent to the browser.
`[src: lib/env.ts:81-92] [src: lib/line-worker.ts:81-83] [src: docs/TERMS_AND_PRIVACY.md:44]`

---

## 5. Sub-processors

| Sub-processor | What it is used for | Where the data is stored |
| :--- | :--- | :--- |
| **Supabase Inc.** | PostgreSQL database, authentication, photo file storage | The production project region must be confirmed before production use |
| **Application hosting provider** | Hosting the web application and API | `[[OWNER INPUT: OI-04]]` — not specified anywhere in this repository |
| **LY Corporation (LINE services)** | Sending the daily report through the Messaging API, and verifying the pet owner's identity through LINE Login / LIFF | Applicable terms and transfer facts must be confirmed from the real production account |
| **Google LLC** | Receiving the Google Sheets export replica the shop initiates | Global cloud infrastructure |

5.1 The identity and facts for each sub-processor (legal entity, server region, and international transfer terms) must be confirmed against the real vendor agreements before production use: `[[OWNER INPUT: OI-11]]`

5.2 In this section, **"not specified"** is not an evasion but a fact about this repository. The existing document states it plainly: "**Hosting provider — TBD** | Hosting the web application/API | The provider and region must be confirmed before production; do not assume Vercel by default." `[src: docs/TERMS_AND_PRIVACY.md:34]`

---

## 6. Data Retention

6.1 Data is retained while the shop continues to use the system.

6.2 After the shop stops using the system, the retention period is `[[OWNER INPUT: OI-05]]`.

6.3 The existing document suggests a value **as a suggestion only**, not an approved value: "when a shop cancels, data in the main system is kept for **30 days** so the shop has time to export its data, after which the system securely deletes it." `[src: docs/TERMS_AND_PRIVACY.md:66]` and the system's target contract states for photos: "photos follow the existing Media Retention Policy (30 days after the end of the contract)." `[src: docs/PRD.md:128]`

6.4 The value in this section only becomes real once the system has verifiable deletion, so it must be confirmed before production use rather than merely declared.

---

## 7. The Pet Owner's Rights

7.1 Under the PDPA the pet owner has the right to access, to a copy, to correction, to deletion, to restriction of processing, to object, to data portability, and to withdraw consent.

7.2 **Rights are exercised through the shop.** Because the shop is the controller, the pet owner must contact the shop (the controller), not WSTERA directly. The shop can act on the data itself through the system dashboard.

7.3 WSTERA, as processor, assists the shop in handling such requests to the extent the system allows and as the shop instructs.

7.4 If WSTERA is to act as an additional coordination channel, an approved channel must be named: `[[OWNER INPUT: OI-02]]`

7.5 Informing the pet owner about how their data is used (section 1.2) is the shop's duty, not WSTERA's.

---

## 8. Security and Breach Notification

8.1 **Data security** — traffic is carried over standard HTTPS/TLS (this statement comes from the project's existing draft and could not be directly confirmed from this repository's code); client-side mutation is restricted by RLS and must go through RPC/server services; LINE tokens are per shop and read server-side only; the system logger redacts sensitive values before writing; the cookies the system sets are only the httpOnly sign-in session cookie and the camera module session cookie, with no advertising or tracking cookies.
`[src: docs/TERMS_AND_PRIVACY.md:43] [src: docs/SYSTEM_ARCHITECTURE.md:65] [src: docs/SYSTEM_ARCHITECTURE.md:80] [src: lib/env.ts:81-92] [src: lib/logger.ts:1-35] [src: lib/auth.ts:15-40] [src: app/api/camera/access/[shopSlug]/route.ts:59-60]`

8.2 **Breach notification** — if WSTERA detects and confirms a personal data breach affecting data it processes for the shop, WSTERA will tell the shop (the controller) without undue delay after confirming the incident.

8.3 **This is a target, not a legal guarantee.** The system aims for within 24 hours, as the existing document states: "**without undue delay after confirming the incident, with a target of notifying within 24 hours**". `[src: docs/TERMS_AND_PRIVACY.md:60]` This is an **operational target** WSTERA will try to meet, not a guarantee that notification will always happen within that time, and not a substitute for the shop's own legal duties. The binding timeframe must be decided and approved: `[[OWNER INPUT: OI-06]]`

8.4 Notifying the Thai Personal Data Protection Committee (PDPC) and the pet owner is the shop's duty as controller. WSTERA will provide the shop with the information the shop needs to do so.

---

## 9. Payment (When Enabled)

9.1 **PS01 has no payment collection in the product today.** There is no checkout page, no connected payment provider, and no payment provider key in this codebase.
`[src: lib/entitlements.ts:2]` (it states "Billing execution and hard quota enforcement are intentionally outside this phase.") and no payment-provider code or dependency was found in this repository — the inspection evidence is in the work note.

9.2 **When payment is enabled**, the payment terms (payment provider, channels, billing timing, automatic renewal, refunds and tax responsibility) will be published in this document and on the checkout page before any real charge is made: `[[OWNER INPUT: OI-09]]`

9.3 **Nothing in this document states that any payment provider is live.** Mentions of Stripe, PromptPay or any other provider elsewhere in the project's documents are not a fact about today's product, and this document makes no such claim.

9.4 Until payment is enabled, using the system does not create a fee collected through this system.

---

## 10. Packages and Prices

10.1 If the shop is given package information in writing, the only publishable values are those already approved in Addendum A-2:

| Package | Monthly price | Limit enforced by the system |
| :--- | :--- | :--- |
| Starter | 590 THB / 17 USD | Up to 10 rooms and 300 pet records |
| Pro | 990 THB / 28 USD | Unlimited rooms and pet records |
| Enterprise | Not for sale | Not for sale yet |

`[src: docs/BUSINESS_MODEL.md:22-24] [src: supabase/migrations/20260926120000_ps01_pricing_a2.sql:24-34] [src: lib/entitlements.ts:15-46] [src: docs/PS01-PRICING-A2-IMPLEMENTATION-2026-09-26.md:8-11]`

10.2 **No annual price is offered.** The system's annual price fields are set to empty and annual assignments are rejected until an approved annual price exists.
`[src: docs/BUSINESS_MODEL.md:18] [src: supabase/migrations/20260926120000_ps01_pricing_a2.sql:29-31] [src: docs/PS01-PRICING-A2-IMPLEMENTATION-2026-09-26.md:12]`

10.3 THB and USD are separate fixed figures. **There is no automatic currency conversion**, and the USD amount is not stored in the system catalogue (it is documented only).
`[src: docs/BUSINESS_MODEL.md:18] [src: docs/PS01-PRICING-A2-IMPLEMENTATION-2026-09-26.md:13]`

10.4 **Prices may change at the Owner's decision**, and the price text in this document must be confirmed before production use: `[[OWNER INPUT: OI-10]]`

---

## 11. Termination, Export and Deletion

11.1 When the shop stops using the system, data is kept for the period in section 6.2 so the shop has time to export it, and is then deleted.

11.2 The shop can export customer and booking data at any time through the Google Sheets sync (section 4.4), which the shop itself initiates, and that replica lives in the shop's own Google account.

11.3 A replica in the shop's Google account is outside WSTERA's control and is not deleted by the system when the shop leaves; the shop must manage that copy itself.

11.4 The scope of backups and the secure deletion method still need confirmation before production use, because the system's operations document lists these as decisions required before launch (backup frequency, media backup strategy, recovery testing schedule, RTO and RPO).
`[src: docs/PRODUCTION_OPERATIONS.md:41-48]`

---

## 12. Changes to This Document and Governing Law

12.1 **Effective date:** `[[OWNER INPUT: OI-07]]`

12.2 This document will change when the system or the Owner's decisions change, and material changes will be notified to shops in advance.

12.3 **The language that prevails if the texts conflict:** `[[OWNER INPUT: OI-08]]` — the project's existing document suggests Thai, because the main market is Thailand, and that is a suggestion only.

12.4 The governing law is Thai law, and disputes fall within the jurisdiction of the Thai courts.

---

## 13. Contact

13.1 **Contact channel for privacy matters and support:** `[[OWNER INPUT: OI-02]]`

13.2 **Person responsible for personal data protection:** `[[OWNER INPUT: OI-03]]` — if there is no dedicated person yet, name the contact who performs this role instead.

13.3 Support is provided through written channels only (no live calls or meetings), following the project's launch support principle, and the exact channel must be confirmed: `[[OWNER INPUT: OI-12]]`

---

*End of the English draft · Sections 1–13 match the Thai version in the same order and with the same numbers so the two can be read side by side · All placeholders are listed in `docs/legal/PS01-OWNER-INPUTS.md`*
