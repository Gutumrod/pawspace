# PS01 — Owner Input List (single list for all placeholders)

**Product:** Pawstia PMS (PS01 / PawSpace) · **Status:** DRAFT — waiting on Owner decisions
**Applies to:** `docs/legal/PS01-TERMS-PRIVACY-TH.md` and `docs/legal/PS01-TERMS-PRIVACY-EN.md`

> Every placeholder in both language files uses the **same single marker**:
> `[[OWNER INPUT: OI-nn]]`
> Values supplied by Owner in Addenda A-10, A-14 and A-16 are marked as resolved below. Older project suggestions
> remain suggestions only unless Owner explicitly approved them.

---

## 1. Placeholder inventory

| Marker | Where it appears (TH / EN) | What the Owner must decide | Value already suggested in existing drafts |
| :--- | :--- | :--- | :--- |
| OI-01 — RESOLVED (A-14/A-16) | §1.3 / §1.3 | The individual provider’s legal name and contact address; Owner confirmed the provider is not a registered company | Legal name: `นาย วชิรญาณ์ จันทร์ขอนแก่น` / `Mr. Wachiraya Jankhonkan`; contact address: `148/522 ซอยรามคำแหง 190 ถนนรามคำแหง แขวงมีนบุรี เขตมีนบุรี กรุงเทพมหานคร 10510` / `148/522 Soi Ramkhamhaeng 190, Ramkhamhaeng Road, Min Buri Subdistrict, Min Buri District, Bangkok 10510, Thailand`. |
| OI-02 — RESOLVED (A-10) | §7.4, §13.1 / §7.4, §13.1 | Owner-approved written support/privacy contact channels | E-mail `titazmth@gmail.com*` (temporary/configurable) and LINE `https://lin.ee/WqDbJcl`; public drafts show the e-mail without `*`. |
| `[[OWNER INPUT: OI-03]]` | §13.2 / §13.2 | Who is responsible for personal data protection (a named DPO, or the contact person acting in that role) | No Owner value supplied; remains open. |
| `[[OWNER INPUT: OI-04]]` | §5 table, §5.2 / §5 table, §5.2 | The application hosting provider and its region | **Suggestion only — no provider is named.** The existing draft states it is undetermined; verify the linked source before launch. |
| OI-05 — RESOLVED (A-10) | §6.2 / §6.2 | The retention period for shop data after the shop stops using the system | 60 days, from the date the shop stops using the system. Actual deletion capability still needs verification. |
| `[[OWNER INPUT: OI-06]]` | §8.3 / §8.3 | The binding breach-notification timeframe to the shop (currently written as a 24-hour target, not a guarantee) | **Suggestion only:** a 24-hour target, from the existing project draft. |
| `[[OWNER INPUT: OI-07]]` | §12.1 / §12.1 | The effective date of the final terms | None; the WSTERA-wide draft uses an `[EFFECTIVE_DATE]` slot. |
| OI-08 — RESOLVED (A-10) | §12.3 / §12.3 | Which language prevails if the Thai and English texts conflict | Thai prevails. |
| `[[OWNER INPUT: OI-09]]` | §9.2 / §9.2 | Payment terms when payment is enabled (provider, channels, billing timing, renewal, tax, and other terms) | Refund request for the first monthly subscription payment is allowed within 7 days of that payment. Other payment terms remain open; PS01 currently does not collect payments. |
| `[[OWNER INPUT: OI-10]]` | §10.4 / §10.4 | Confirmation of the published package prices and acceptance that prices are changeable | Existing package values remain unapproved for this legal draft; see the business model source of truth. |
| `[[OWNER INPUT: OI-11]]` | §5.1 / §5.1 | Confirmation of sub-processor legal entities, server regions and international transfer terms against the real vendor agreements | None; the draft marks vendor facts pending confirmation. |
| `[[OWNER INPUT: OI-12]]` | §13.3 / §13.3 | Published support hours | Support channels are resolved by A-10 as e-mail `titazmth@gmail.com*` and LINE `https://lin.ee/WqDbJcl`; hours remain unprovided. |

**Open placeholder ids: 8** (OI-03, OI-04, OI-06, OI-07, OI-09, OI-10, OI-11, OI-12). OI-01 is resolved by Addendum A-14/A-16; OI-02, OI-05 and OI-08 are resolved by Addendum A-10.

**Occurrences by file** (the marker text appears in more than one part of the same document for
some ids, because the same decision is referenced in more than one clause):

| File | Distinct ids used | Marker occurrences |
| :--- | :--- | :--- |
| `docs/legal/PS01-TERMS-PRIVACY-TH.md` | 8 open ids | 8 |
| `docs/legal/PS01-TERMS-PRIVACY-EN.md` | 8 open ids | 8 |
| `docs/legal/PS01-OWNER-INPUTS.md` | 8 open ids | 8 |

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

1. Keep this file as the single status record for each Owner decision.
2. Replace only open `[[OWNER INPUT: OI-nn]]` markers in both language files with the same decided value, keeping the two files structurally parallel.
3. Do not remove any numbered section; only fill values and adjust wording.
4. Any value marked **suggestion only** above must be confirmed explicitly; it must not be treated as approved just because it already appears in an earlier draft.
