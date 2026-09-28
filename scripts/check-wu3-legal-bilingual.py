#!/usr/bin/env python3
"""WU3-LEGAL-BILINGUAL acceptance self-check (documentation-only unit).

Verifies, from the files on disk:
  - the three legal files exist and are non-empty
  - TH and EN have the same numbered section headings in the same order
  - one consistent placeholder marker is used and the Owner-input file covers it
  - both language files carry the draft banner + not-legal-advice statement
  - price tokens are limited to Addendum A-2 values, no provider is claimed live
  - prints per-file bytes and sha256
Read-only apart from nothing; no network, no writes.
"""
import hashlib
import pathlib
import re

REPO = pathlib.Path(__file__).resolve().parents[1]
LEGAL = REPO / "docs" / "legal"
NON_ASCII_SCRIPT = "th"

FILES = [
    LEGAL / "PS01-TERMS-PRIVACY-TH.md",
    LEGAL / "PS01-TERMS-PRIVACY-EN.md",
    LEGAL / "PS01-OWNER-INPUTS.md",
    REPO / "docs" / "house-swarm-5a" / "WU3-LEGAL-BILINGUAL.md",
]

MARKER = re.compile(r"\[\[OWNER INPUT: (OI-\d+)\]\]")


def read(path):
    return path.read_text(encoding="utf-8")


def sections(text):
    return [(m.group(1), m.group(2).strip())
            for m in re.finditer(r"^## (\d+)\. (.+)$", text, re.M)]


def main():
    ok = True
    texts = {}
    for path in FILES:
        exists = path.is_file()
        raw = path.read_bytes() if exists else b""
        texts[path] = raw.decode("utf-8") if exists else ""
        print(f"FILE {path.relative_to(REPO).as_posix()} exists={exists} "
              f"bytes={len(raw)} sha256={hashlib.sha256(raw).hexdigest()}")
        if not exists or len(raw) == 0:
            ok = False

    th_path, en_path, oi_path = FILES[0], FILES[1], FILES[2]
    th, en, oi = texts[th_path], texts[en_path], texts[oi_path]

    sth, sen = sections(th), sections(en)
    print(f"\nTH sections={len(sth)} nums={[n for n, _ in sth]}")
    print(f"EN sections={len(sen)} nums={[n for n, _ in sen]}")
    same = [n for n, _ in sth] == [n for n, _ in sen]
    print(f"SAME NUMBER ORDER={same}")
    ok &= same and len(sth) > 0

    th_ids, en_ids = sorted(set(MARKER.findall(th))), sorted(set(MARKER.findall(en)))
    oi_ids = sorted(set(MARKER.findall(oi)))
    print(f"\nTH occurrences={len(MARKER.findall(th))} distinct={len(th_ids)}")
    print(f"EN occurrences={len(MARKER.findall(en))} distinct={len(en_ids)}")
    print(f"OI occurrences={len(MARKER.findall(oi))} distinct={len(oi_ids)}")
    print(f"TH distinct == EN distinct: {th_ids == en_ids}")
    print(f"OI set == TH set: {set(oi_ids) == set(th_ids)}")
    print(f"OI covers EN: {set(en_ids) <= set(oi_ids)}")
    ok &= th_ids == en_ids and set(oi_ids) == set(th_ids)

    other = sorted(set(re.findall(r"\[\[(?!OWNER INPUT: OI-)[^\]]*\]\]", th + en)))
    brackets = sorted(set(re.findall(
        r"\[(TBD|EFFECTIVE_DATE|OPERATOR|CONTACT|DPO|RETENTION|Owner[^\]]*)\]", th + en)))
    print(f"NON-CONFORMING [[ ]] markers: {other}")
    print(f"OTHER bracket placeholders: {brackets}")
    ok &= not other and not brackets

    for name, text in (("TH", th), ("EN", en)):
        banner = {
            "draft_for_review": ("ฉบับร่างเพื่อการตรวจทาน" in text) or ("DRAFT for review" in text),
            "not_legal_advice": ("ไม่ใช่คำปรึกษาทางกฎหมาย" in text) or ("NOT legal advice" in text),
            "owner_approval": ("อนุมัติจากเจ้าของกิจการ" in text) or ("Owner approval" in text),
            "no_production_use": ("ห้ามนำไปใช้จริงในระบบ production" in text) or ("NO production use yet" in text),
        }
        print(f"{name} banner: {banner}")
        ok &= all(banner.values())

    # Source citations are wrapped in backticks; strip those spans so citation line
    # numbers (e.g. tenant-context.ts:41-43) are not misread as prices.
    backticked = re.compile(r"`[^`]*`")
    allowed_prices = {"590", "990", "17", "28"}
    for name, text in (("TH", th), ("EN", en)):
        body = backticked.sub(" ", text)
        tokens = set(re.findall(r"\b(?:590|990|17|28|2490|1490|490|390|25|43|71)\b", body))
        unexpected = tokens - allowed_prices
        print(f"{name} price tokens (citations excluded)={sorted(tokens)} unexpected={sorted(unexpected)}")
        ok &= not unexpected

    # Provider names may appear ONLY inside the section 9.3 clause that explicitly
    # denies any provider is live. Every line naming one must carry a live-denial marker.
    provider_words = ("Stripe", "PromptPay", "Omise", "2C2P")
    denial_markers = ("เปิดใช้อยู่จริง", "provider is live")
    for name, text in (("TH", th), ("EN", en)):
        offenders = []
        for line in text.splitlines():
            if any(w in line for w in provider_words):
                if not any(m in line for m in denial_markers):
                    offenders.append(line.strip()[:120])
        print(f"{name} provider lines without a live-denial: {offenders}")
        ok &= not offenders

    print(f"\nSELF-CHECK={'PASS' if ok else 'FAIL'}")


if __name__ == "__main__":
    main()
