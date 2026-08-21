# PawSpace Phase 10 — Pilot Runbook

Date: 2026-08-21
Scope: one-store closed-beta pilot only. This runbook does not enable billing, paid quota enforcement, multi-branch, AI receptionist, or any post-pilot monetization work.

## 1. Required Environment / Credentials

Core runtime:
- `NEXT_PUBLIC_SUPABASE_URL` — PawSpace Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon/publishable key.
- `SUPABASE_SERVICE_ROLE_KEY` — server only; never expose to browser/client bundle.

LINE owner-link / report delivery:
- `LINE_LOGIN_CHANNEL_ID` — LINE Login verification audience.
- `LINE_CHANNEL_ACCESS_TOKENS_JSON` — server-only JSON keyed by PawSpace shop UUID.
- `LINE_DISPATCH_SECRET` — server-only internal dispatcher secret.

Google Sheets:
- `GOOGLE_SERVICE_ACCOUNT_JSON` — server-only service-account credential JSON.
- `GOOGLE_SYNC_DISPATCH_SECRET` — server-only worker dispatch secret.

Camera, only when pilot camera is enabled:
- `CAMERA_SESSION_SIGNING_SECRET`
- `CAMERA_IP_HASH_PEPPER`
- `CAMERA_ALLOWED_FEED_HOSTS`
- `CAMERA_REQUESTER_IP_HEADER`

Do not place any server-only secret in `NEXT_PUBLIC_*`, browser storage, committed files, screenshots, or operator notes.
## 2. One-Store Onboarding Sequence

1. Create and confirm the first Owner account in Supabase Auth using the pilot owner's real email.
2. Bootstrap exactly one shop through the trusted `bootstrap_shop` path using that authenticated user's JWT. V1 keeps one Auth user in one shop membership.
3. Verify the Owner can log in to PawSpace and reaches `/` with the correct shop name and `owner` role.
4. From **ตั้งค่าร้าน**, create room inventory and confirm room status starts as `available` unless maintenance is active.
5. From **Staff management**, invite the Manager and Staff accounts required for the pilot.
6. Add the first customer and pet, then create a test booking, assign the pet, check in, create a Daily Report, check out, and mark the room clean.
7. Configure LINE and Google Sheets only after the core local operational loop passes.

First-owner bootstrap is operator-assisted in Phase 10; there is no public self-service tenant-signup flow. Do not bypass `bootstrap_shop` with browser table inserts.

## 3. Owner / Manager / Staff Setup

Owner:
- Can perform core operations, room configuration, integrations, and staff management.
- Invite staff with email, name, role, and either a temporary password or the normal Supabase invite/reset flow.
- Do not remove, disable, or demote the last active Owner; the DB invariant rejects it.

Manager:
- Can perform core operations, room configuration, LINE reset, and Google Sheet binding/disconnect.
- Cannot manage staff accounts or roles.

Staff:
- Can perform core room/booking/customer/pet/Daily Report operations.
- Cannot manage room configuration, integrations, or staff accounts.

After every invite, test the invited user's actual login before considering onboarding complete.
## 4. Room Setup and Daily Operations

Room setup:
- Owner/Manager opens **ตั้งค่าร้าน**.
- Create room number, type, pet capacity, and base nightly price.
- Use maintenance dates only through the maintenance controls; do not change room status directly.
- Maintenance cannot override an occupied or cleaning room.

Booking loop:
1. Create customer and pet records.
2. Create a confirmed booking with owner, room, check-in date, and check-out date.
3. Assign at least one pet before check-in.
4. Check in only on the Bangkok business date and only when the room is eligible.
5. During the stay, create Daily Reports with 1–4 images.
6. Check out; the room must move to `cleaning`.
7. After physical cleaning is complete, use **Mark clean**; the room returns to `available`.

Never work around a rejected transition by editing Supabase tables directly. Treat the RPC error as the authoritative operational state.

## 5. LINE Owner-Link Setup

1. Open **ลูกค้า & สัตว์** and select the customer owner.
2. Generate a LINE claim token. The token is single-use, stored hashed at rest, and expires after 48 hours.
3. Send the one-time token into the existing LINE/LIFF claim flow.
4. The trusted server verifies the LINE-issued ID token before consuming the PawSpace claim.
5. Confirm the owner shows `LINE linked` before relying on report delivery.
6. Owner/Manager may use **Reset LINE** when re-linking is required, then generate a fresh claim.

Do not copy claim tokens into logs, analytics, screenshots, or persistent notes.
## 6. Google Sheet Binding

1. Owner/Manager opens **ตั้งค่าร้าน → Google Sheets**.
2. Generate a verification token; TTL is 15 minutes.
3. Put that exact plaintext token in `PawSpace_Config!B1` of the target Sheet.
4. Enter the target Sheet ID in PawSpace and select **Verify & bind**.
5. The trusted server reads `PawSpace_Config!B1` using the service account and binds only after proof matches the current shop.
6. Confirm Customers and Bookings sync begins; a new binding seeds a full current snapshot.

A browser-supplied Sheet ID alone is never proof of control. Do not call `connect_google_sheet_internal` from the browser.

## 7. Daily Opening Smoke Check

Before taking the first booking of the day:
- Log in as the actual duty role and confirm the correct shop/role is shown.
- Confirm Bangkok business date is correct.
- Confirm no room is unexpectedly stuck in `occupied`, `cleaning`, or `maintenance`.
- Check today's confirmed/check-in bookings against the front-desk list.
- Confirm linked LINE owners are visible for stays that require reports.
- If Google Sheets is enabled, confirm it is still shown as connected.
- Do not treat a degraded external integration as success; operate manually and record the incident.

## 8. Daily Closing Smoke Check

- Confirm every completed stay is checked out.
- Confirm physically cleaned rooms have been marked clean.
- Review today's Daily Reports and retry only rows explicitly in `failed` state.
- Confirm no pending operational booking was accidentally cancelled.
- Spot-check Google Sheet records when the integration is enabled.
- Record any external LINE/Google failure for manual follow-up; do not alter DB delivery state directly.
## 9. Rollback / Disable Integration

LINE:
- Stop the internal LINE dispatcher/cron trigger first when delivery is unsafe.
- Keep report rows intact; do not rewrite `line_delivery_status` manually.
- Use retry only after the upstream credential/configuration problem is fixed.
- Reset an individual customer's LINE link only through the authorized reset action.

Google Sheets:
- Use **Disconnect Google Sheet** as Owner/Manager to stop tenant sync routing.
- Stop the internal Google sync dispatcher if the worker itself is unhealthy.
- Rebind only through a fresh proof-of-control token; never restore an old binding by direct table update.

Camera:
- Disable camera using the existing Phase 8 authorized settings path or remove the upstream configuration.
- Do not expose an upstream camera URL or credential directly to visitors.

Core operations rollback:
- If a new application build is defective, roll back the application deployment to the last reviewed commit.
- Phase 10 adds no database migration, so rollback must not rewrite or downgrade Phase 1–9 migrations.

## 10. Known Pilot Limitations / Manual Checks

- Closed-beta, one-store workflow only; no multi-branch operations.
- First tenant/Owner bootstrap is operator-assisted, not self-service.
- External LINE and Google credentials require a manual real-credential smoke test before the store relies on them.
- No billing, checkout, payment webhook, subscription renewal, or paid quota enforcement is active in Phase 10.
- Entitlements may be displayed but are not a payment or hard-quota gate.
- No AI receptionist, AI workflow, clinic/grooming/vaccine/passport features, or automatic import.
- Browser E2E uses local Supabase and mocked/local external boundaries; it does not prove third-party uptime.
- Local Supabase Storage uses loopback HTTP; PawSpace accepts HTTP image URLs only for `localhost`/`127.0.0.1`. External image URLs remain HTTPS-only.
- Before pilot opening, perform one manual end-to-end stay using the store's real staff accounts, real LINE owner link, and (if enabled) real Google Sheet.
