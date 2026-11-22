---
phase: "8"
slug: "fold-persistence"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-22"
---

# Phase 8 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| renderer → client storage | `workspace-registry.v1` is client-local (desktop `drafts.sqlite` via IPC, Web `localStorage`) | Directory paths, titles, row order, fold flags |
| stored document → renderer | Persisted JSON is decoded by `Persistence.withInitial` before use | Untrusted stored booleans / strings |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-8-01 | Tampering | `workspace-registry.v1` `expanded` map | low | mitigate | `Persistence.record(Schema.Boolean)` + `withInitial` recover: invalid fold values reset the map to `{}` without affecting entries/scrollTop | closed |
| T-8-02 | Spoofing | rowKey identity | low | mitigate | Fold keys use existing `directoryKey` normalization (Windows drive casing, separators, trailing slashes); no new identity source | closed |
| T-8-03 | Denial of service | unbounded `expanded` keys | low | accept | Folding deletes its key and `remove()` prunes the removed workspace's key, so the map is bounded by the currently expanded registered rows | open — below high threshold (non-blocking) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-8-01 | T-8-03 | Single-user personal fork; fold keys are written only by explicit user clicks and pruned on collapse/removal, so the map cannot grow without user action | project owner | 2026-11-22 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-22 | 3 | 2 | 1 (low, accepted) | primary agent |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-22
