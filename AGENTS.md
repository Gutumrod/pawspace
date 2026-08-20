<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## PawSpace — Mandatory Module Hub Reuse Gate

Before implementing any new capability, check Module Hub first.

Module Hub path:
`D:\AI-Workspace\projects\modules-hub`

Module Hub is a **copy-and-own source library**. For PawSpace work, treat the Module Hub repository as **READ-ONLY**.

Mandatory rules:

1. Never modify Module Hub to satisfy a PawSpace requirement.
2. Never import Module Hub code across repository/filesystem paths.
3. Before selecting a module, read the current Module Hub `README.md`, `INDEX.md`, `SECURITY.md`, and `modules/REGISTRY.md` from disk.
4. Inspect the candidate module's real source/version/status and relevant `MODULE.md`, `DESIGN.md`, integration example, tests, limitations, and host responsibilities before approving reuse.
5. `Completed` means the Module Hub completion gate passed; it does **not** mean automatic compatibility with PawSpace.
6. Compare the module contract against PawSpace `docs/PRD.md`, `docs/SYSTEM_ARCHITECTURE.md`, and all locked product/security invariants.
7. If compatible, copy the **complete module directory** into PawSpace first. PawSpace owns that copy from then on.
8. Adapt only the copied PawSpace version. Never back-port PawSpace-specific hacks into Module Hub.
9. Host configuration/secrets must be injected by PawSpace. Never hard-code credentials or production data.
10. If a module weakens tenant isolation, authoritative RPC/RLS, security boundaries, lifecycle invariants, or another PawSpace contract, do not use it as-is.

Every Phase brief must record the Module Hub compatibility result for each relevant candidate as one of:

- `APPROVED TO REUSE` — copy complete module into PawSpace, then adapt the PawSpace-owned copy.
- `ADAPTER ONLY` — only a compatible subset/adapter pattern may be used without replacing PawSpace authority.
- `NOT COMPATIBLE` — contract conflicts with PawSpace; do not use.
- `NOT NEEDED` — no relevant module is required for this Phase.

Required implementation workflow:

`Explain Phase → Check Module Hub → Compatibility Gate → Copy Approved Module(s) into PawSpace → Implement/Adapt → Test → Inspect → Verdict`

If Module Hub has uncommitted changes, version/status drift, or unclear source state, do not blindly copy it. Inspect the real repository state first and record the risk in the Phase report.

## PawSpace Chat Partition Rule

Development/review context is split deliberately:

- Chat group 1: Phase 1–3
- Chat group 2: Phase 4–6
- Chat group 3: Phase 7–9
- Final chat group: Phase 10 Pilot

At each boundary, create/read a local handoff file before continuing. A new chat must not infer prior Phase state from conversation memory alone; it must verify the local repository, commits, Source of Truth, unresolved issues, and review gates from disk.
