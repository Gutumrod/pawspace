# PS01 — Owner Input List (single list for all placeholders)

**Product:** Pawstia PMS (PS01 / PawSpace) · **Status:** DRAFT — waiting on Owner decisions
**Applies to:** `docs/legal/PS01-TERMS-PRIVACY-TH.md` and `docs/legal/PS01-TERMS-PRIVACY-EN.md`

> Every placeholder in both language files uses the **same single marker**:
> `[[OWNER INPUT: OI-nn]]`
> A point that the existing project documents already suggest a value for is written below with
> that value marked explicitly as **a suggestion only**, not an approved value.

---

## 1. Placeholder inventory

| Marker | Where it appears (TH / EN) | What the Owner must decide | Value already suggested in existing drafts |
| :--- | :--- | :--- | :--- |
| `[[OWNER INPUT: OI-01]]` | §1.3 / §1.3 | The WSTERA legal entity name (and legal form/address) that acts as the data processor and service operator | Existing Thai draft says the operator identity is undetermined ("legal entity/operator TBD before production") — no value offered; `docs/TERMS_AND_PRIVACY.md:13` |
| `[[OWNER INPUT: OI-02]]` | §7.4, §13.1 / §7.4, §13.1 | The approved written contact channel for privacy matters and support (email or LINE) | None in the PS01 draft; the WSTERA-wide draft uses a `[CONTACT]` slot and notes written-only support |
| `[[OWNER INPUT: OI-03]]` | §13.2 / §13.2 | Who is responsible for personal data protection (a named DPO, or the contact person acting in that role) | None; the WSTERA-wide draft notes that if there is no statutory DPO, name the contact instead |
| `[[OWNER INPUT: OI-04]]` | §5 table, §5.2 / §5 table, §5.2 | The application hosting provider and its region | **Suggestion only — no provider is named.** The existing draft states it is undetermined: `docs/TERMS_AND_PRIVACY.md:34` ("Hosting provider — TBD … do not assume Vercel by default") |
| `[[OWNER INPUT: OI-05]]` | §6.2 / §6.2 | The retention period for shop data after the shop stops using the system | **Suggestion only:** 30 days, from `docs/TERMS_AND_PRIVACY.md:66`; photos 30 days after end of contract, from `docs/PRD.md:128` |
| `[[OWNER INPUT: OI-06]]` | §8.3 / §8.3 | The binding breach-notification timeframe to the shop (currently written as a 24-hour target, not a guarantee) | **Suggestion only:** a 24-hour target, from `docs/TERMS_AND_PRIVACY.md:60` |
| `[[OWNER INPUT: OI-07]]` | §12.1 / §12.1 | The effective date of the final terms | None; the WSTERA-wide draft uses an `[EFFECTIVE_DATE]` slot |
| `[[OWNER INPUT: OI-08]]` | §12.3 / §12.3 | Which language prevails if the Thai and English texts conflict | **Suggestion only:** Thai, from the WSTERA-wide draft (`L15-WSTERA-TERMS-PRIVACY-DRAFT-2026-09-26.md:20`), because the main market is Thailand |
| `[[OWNER INPUT: OI-09]]` | §9.2 / §9.2 | The payment terms to publish when payment is enabled (provider, channels, billing timing, renewal, refunds, tax) | None; PS01 has no payment collection today (`lib/entitlements.ts:2`) and no provider is named or claimed live |
| `[[OWNER INPUT: OI-10]]` | §10.4 / §10.4 | Confirmation of the published package prices and acceptance that prices are changeable | **Suggestion only:** the Addendum A-2 values already in the repository — Starter 590 THB / 17 USD, Pro 990 THB / 28 USD, Enterprise not for sale, annual not offered (`docs/BUSINESS_MODEL.md:18-24`) |
| `[[OWNER INPUT: OI-11]]` | §5.1 / §5.1 | Confirmation of sub-processor legal entities, server regions and international transfer terms against the real vendor agreements | None; the existing draft marks every sub-processor entry as pending vendor confirmation |
| `[[OWNER INPUT: OI-12]]` | §13.3 / §13.3 | The exact support channel and hours | None in the PS01 draft; the project's locked rule L-13 fixes support as written/channel-only (no live calls), stated as a direction rather than a channel |

**Count of distinct placeholders: 12** (OI-01 … OI-12).

**Occurrences by file** (the marker text appears in more than one part of the same document for
some ids, because the same decision is referenced in more than one clause):

| File | Distinct ids used | Marker occurrences |
| :--- | :--- | :--- |
| `docs/legal/PS01-TERMS-PRIVACY-TH.md` | OI-01 … OI-12 (12) | 13 |
| `docs/legal/PS01-TERMS-PRIVACY-EN.md` | OI-01 … OI-12 (12) | 13 |
| `docs/legal/PS01-OWNER-INPUTS.md` | OI-01 … OI-12 (12) | 12 |

Occurrence counts are verified by command in `docs/house-swarm-5a/WU3-LEGAL-BILINGUAL.md`.

---

## 2. Decisions that are not placeholders but still belong to the Owner

These are not text slots; they are operating decisions the drafts deliberately do not settle.

1. **Public photo bucket trade-off (§4.5).** The photos bucket is public-read and protected only by unguessable paths. Accepting that trade-off, or requiring signed expiring URLs (which affects LINE message rendering), is an Owner decision.
2. **Deletion capability (§6.4).** The retention period can only be honoured once verifiable deletion exists; promising a period before that would be a false claim.
3. **Whether a separate DPA is needed (§1.4)** between the shop and WSTERA, in addition to these documents.
4. **Final legal review.** These drafts are not legal advice; the final text needs Owner approval and, where required, external legal review.

---

## 3. How to use this list

1. Fill each `OI-nn` value in this file first, so there is one source of truth per decision.
2. Replace the matching `[[OWNER INPUT: OI-nn]]` marker in **both** language files with the same decided value, keeping the two files structurally parallel.
3. Do not remove any numbered section; only fill values and adjust wording.
4. Any value marked **suggestion only** above must be confirmed explicitly; it must not be treated as approved just because it already appears in an earlier draft.
