# PS01 Owner Manual Test — POST

Date: 2026-09-09 (Asia/Bangkok)
Tester: Owner
Status: `PENDING OWNER EXECUTION`

This file intentionally contains no invented PASS/FAIL result.
It must be completed only from the Owner's actual manual run against the approved WSTERA LAB test surface.

## Run metadata

- House H3D/LAB ready confirmation: `PENDING`
- Test URL/surface: `PENDING`
- Staff test identity: record label only; do not store password/token here
- Customer LINE test identity: record label only; do not store token here
- Start timestamp: `PENDING`
- End timestamp: `PENDING`
- Branch/commit presented to Owner: `PENDING`

## Result matrix

| Case | Scope | Result | Actual / evidence |
|---|---|---|---|
| O-01 | Login/dashboard | PENDING | |
| O-02 | Room + Rate Plans | PENDING | |
| O-03 | 1 HOUR quote snapshot | PENDING | |
| O-04 | 3 HOUR duration | PENDING | |
| O-05 | overlap/back-to-back | PENDING | |
| O-06 | DAY + calendar MONTH | PENDING | |
| O-07 | maintenance + capacity | PENDING | |
| O-08 | inactive Rate Plan | PENDING | |
| O-09 | historical quote preservation | PENDING | |
| O-10 | check-in/out/cleaning | PENDING | |
| O-11 | Customer LIFF context | PENDING | |
| O-12 | Staff/Customer quote parity | PENDING | |
| O-13 | Customer request -> Staff confirm | PENDING | |
| O-14 | decline path | PENDING | |
| O-15 | confirmation revalidation race | PENDING | |
| O-16 | cross-shop isolation | PENDING | |

Allowed result values:
`PASS | FAIL | BLOCKED | NOT RUN`

## Defects found by Owner

Record each defect as:
- defect ID
- case ID
- exact input/action
- expected result
- actual result
- screenshot/time
- reproducible: yes/no
- severity: `P0 | P1 | P2 | P3`

No defect is considered fixed until the same case is rerun after remediation.

## Owner observations

Capture product-level observations separately from hard defects:
- confusing wording/flow
- missing information
- too many clicks
- mobile usability
- staff workflow friction
- customer booking friction
- anything that feels unsafe or ambiguous

## Final Owner verdict

Choose only after the matrix is complete:

- `PASS` — required cases passed; no release-blocking defect.
- `PASS WITH REMEDIATION` — core behavior passed but bounded non-blocking fixes are required.
- `REMEDIATE` — one or more required cases failed.
- `BLOCKED` — prerequisite/environment prevented a meaningful run.

Final verdict: `PENDING`

## Retest section

For every remediated defect, append:
`defect ID -> fix commit -> rerun case -> result -> evidence timestamp`.
Do not overwrite the original failed observation; preserve before/after history.
