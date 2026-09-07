# PS-SR-02 — Free-First Hosting Compatibility Audit

**Date:** 2026-09-06
**Product:** Pawstia PMS (PS01)
**Mode:** WSTERA BUILD-TO-SELL / FREE-FIRST
**Scope:** Phase A audit only — no provider provisioning, no code/config implementation
**Verdict:** PASS WITH RECOMMENDATION — Render Free Web Service is the best current zero-fixed-cost staging path

## 1. Owner Policy Applied

- Pre-revenue products must use a viable free path before any paid option.
- A paid provider is not considered while a free path can satisfy the required acceptance criteria.
- Provider choice starts from product requirements, not provider preference.
- No Vercel Pro or other paid hosting is authorized by this audit.

## 2. Verified Repository Runtime Facts

Repository/worktree inspected:
`D:\AI-Workspace\projects\saas-product-hub\products\PawSpace-pssr02-staging`

Current application stack:
- Next.js 16.3.1 App Router
- React 19.2.8
- Node/server-side route handlers
- Supabase database/Auth/Storage
- `sharp` 0.35.3 for Daily Report media processing
- `google-auth-library` 11.0.2 for Google Sheets service-account auth
Six route handlers explicitly require `runtime = "nodejs"`:
- camera access
- camera feed
- camera stream
- daily reports
- internal Google sync
- internal LINE dispatch

Daily Report accepts up to 4 images and allows each source image up to 10 MiB. It decodes, validates, rotates, resizes, converts and hashes the image using `sharp` before uploading to Supabase Storage.

Camera streaming is an authenticated server-side proxy. The session TTL is 30 minutes and the route returns a streamed upstream response.

Canonical CI uses Ubuntu + Node.js 22 and has already passed the application build and full isolated verification matrix. This is evidence that Linux + Node is a known-good deployment class.

## 3. Local Compatibility Probes

### 3.1 Cloudflare vinext check

Command:
`pnpm dlx vinext@latest check`

Result:
- exit 0
- 93% compatible
- 13 supported, 0 partial, 1 issue
- only reported issue: missing `"type": "module"` required by Vite
- repository status unchanged by the check
Important limitation: the vinext compatibility checker validates the Next.js API surface but did not flag the application's heavy `sharp` workload. It must not be treated as complete runtime proof.

### 3.2 Real `sharp` CPU probe

The actual `prepareDailyReportImage()` implementation was executed against a generated 4000×3000 JPEG without writing test files into the repository.

Observed result:
- source: 70,763 bytes
- output: 2,625 bytes
- wall time: 37.41 ms
- process CPU: 30.00 ms

Even this highly compressible synthetic image required approximately 30 ms CPU for the Pawstia image pipeline alone.

### 3.3 Generic Node web-service contract probe

Existing built application was started with:
`PORT=10000 pnpm start`

Observed:
- Next.js 16.3.1 started successfully
- ready in 174 ms
- bound to port 10000
- GET `/` returned HTTP 200
- repository status remained unchanged

This proves the current app can run as a conventional Node web service without a provider-specific adapter.
## 4. Provider-Neutral Candidate Evaluation

### Cloudflare Workers Free — BLOCKED FOR CURRENT CONTRACT

Positive evidence:
- Current Cloudflare recommendation for Next.js 16 is vinext.
- App Router and Route Handlers are supported.
- Node.js compatibility is enabled by default on current compatibility dates.
- vinext checker reports 93% compatibility.

Blocking evidence:
- Workers Free allows only 10 ms CPU per HTTP request.
- Cloudflare documentation notes SSR/auth/large-payload workloads commonly consume 10–20 ms CPU even without Pawstia image work.
- Pawstia's actual `sharp` pipeline consumed 30 ms CPU by itself in the local probe.

Conclusion: current Daily Report media contract cannot be safely placed on Workers Free without moving or redesigning image processing. That architecture change is unnecessary while another free path exists.

### Netlify Free — BLOCKED FOR CURRENT CONTRACT

Positive evidence:
- Commercial projects are allowed on Netlify Free.
- Modern Next.js App Router, Route Handlers, SSR and response streaming are supported through Netlify's OpenNext adapter.

Blocking evidence:
- Next.js Route Handlers are provisioned as Netlify Functions.
- Buffered function payload is 6 MB; binary uploads are effectively limited to about 4.5 MB because of encoding overhead.
- Pawstia currently permits a single Daily Report source image up to 10 MiB.
- Streaming functions have a 60-second execution limit, while Pawstia camera sessions are designed for 30 minutes.
Conclusion: Netlify Free would require changing the upload architecture and camera delivery contract. Do not remediate toward Netlify while a free path can preserve the current application contract.

### Railway Free — REJECTED FOR CLOSED-BETA STAGING

Positive evidence:
- Full Node-style service deployment is available.
- Free plan has no monthly subscription fee.

Reasons not selected:
- only $1/month of free resource credit
- idle services still consume metered RAM
- Free plan deployments in Southeast Asia are restricted during 08:00–20:00 Singapore time
- this introduces avoidable availability/operational pressure for a real-store beta

### AWS Amplify — NOT SELECTED

Amplify supports Next.js SSR, but its current free access is tied to AWS Free Tier/credits and time-bounded new-account benefits. This creates a future cost trigger before Pawstia has proven revenue and is unnecessary while an ongoing zero-fixed-cost path exists.

### Render Free Web Service — PASS FOR STAGING / CLOSED BETA

Evidence supporting the current Pawstia contract:
- native Node.js web services; Next.js is explicitly supported
- no provider-specific Next.js runtime adapter required for the current `pnpm start` application contract
- current default Node 24.14.1; project can explicitly pin Node 22 to match canonical CI
- Free compute: 0.1 CPU / 512 MB RAM
- HTTP responses can run up to 100 minutes, covering Pawstia's 30-minute camera stream contract
- custom domains, managed TLS, logs, service previews and rollback to the two previous deploys are available on Free
Render Free limitations that must remain explicit:
- free service spins down after 15 minutes without inbound traffic
- first request after sleep can take about one minute to wake the service
- 750 free instance-hours per workspace per calendar month
- Free service has no SLA and may restart
- Render explicitly says Free is not for general production applications
- 0.1 CPU / 512 MB still requires a real Daily Report media smoke before PS-SR-02 can close

These limitations are acceptable for PS-SR-02 isolated staging. Use for PS-SR-04 one-store Closed Beta remains PROVISIONAL and must be accepted against real-store usability evidence before onboarding the store.

Pawstia persists business data and media in Supabase, not the application filesystem, so Render Free's ephemeral filesystem does not violate the existing persistence architecture.

## 5. Free-First Recommendation

### PS-SR-02 staging

Recommended stack:
- Application runtime: **Render Free Web Service**
- Database/Auth/Storage: **isolated Supabase Free staging project**
- Initial hostname: Render-provided staging hostname; no paid domain requirement
- Secrets: staging-only provider environment variables; never reuse production credentials

Cost target: **THB 0/month fixed infrastructure cost**.

Cost safety rule for Render:
- do not add a payment method solely for this staging service if the account permits operation without one
- prefer fail-closed suspension over automatic overage billing
- never enable a paid compute plan or paid workspace as part of PS-SR-02
## 6. Phase B Plan — NOT YET EXECUTED

After Owner approval:
1. Create/verify isolated Supabase Free staging project.
2. Create Render Free Web Service linked to the Pawstia repository/approved staging branch.
3. Pin Node.js to the canonical tested major (Node 22) in provider configuration.
4. Configure staging-only environment variables and `APP_BASE_URL`.
5. Build with frozen dependencies and start using the existing Node service contract.
6. Apply the 13 Supabase migrations using non-destructive `db push`.
7. Run cloud smoke: login, two-tenant isolation, core booking/room/pet loop, Daily Report image processing, LINE/Sheets integration boundary, and camera stream.
8. Prove rollback/redeploy and record deployment identity.
9. Run Stage Gate → QA → deterministic integration before closing PS-SR-02.

No Phase B action is authorized by this audit alone.

## 7. Evidence Sources Checked 2026-09-06

Provider documentation:
- Cloudflare Next.js/vinext: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Netlify Next.js: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- Netlify Functions limits: https://docs.netlify.com/build/functions/configuration/
- Render Free: https://render.com/docs/free
- Render Node runtime: https://render.com/docs/node-version
- Render web services: https://render.com/docs/web-services
- Railway plans: https://docs.railway.com/pricing/plans
- AWS Amplify pricing: https://aws.amazon.com/amplify/pricing/

## Final Phase A Verdict

**PASS WITH RECOMMENDATION**

Use **Render Free Web Service + isolated Supabase Free staging** as the next PS-SR-02 implementation plan. Cloudflare Workers Free and Netlify Free currently conflict with Pawstia runtime contracts; Railway Free and AWS Amplify are inferior under the Owner's pre-revenue zero-fixed-cost policy.
