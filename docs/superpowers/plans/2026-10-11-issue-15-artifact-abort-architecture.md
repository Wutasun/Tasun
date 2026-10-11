# Issue #15 — Artifact Abort Semantics Architecture Draft

Date: 2026-10-11  
Requirement: GitHub Issue #15 — `[REQ] Distinguish artifact supersession AbortError from timeout retry`  
Functional R-number: NOT ASSIGNED  
Status: ARCHITECTURE APPROVED / WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED

## 1. Baseline authority

Architecture tracing baseline:

`main @ 0577989e0f9cca514e120b10c1ed2228d2f4192b`

This main includes the formal Exact Auto Release produced after Issue #14 closure.

Implementation, if later approved, must branch from the latest current `main` at written-spec approval time.

## 2. Verified current call chain

Current register-page artifact verification path:

`startProbe(reason)`
→ `probe(force)`
→ parallel `fetchBuffer(VERSION_URL, PROBE_TIMEOUT, "manifest")`
   + `fetchBuffer(PAGE_FILE, PROBE_TIMEOUT, "html")`
→ manifest / alias / HTML build / SHA verification
→ `releaseGate(...)` or bounded retry/fallback.

`fetchBuffer()` currently:

1. creates its own `AbortController`;
2. starts a bounded timeout;
3. on timeout constructs a `TimeoutError` reason and calls `ctl.abort(reason)`;
4. passes `ctl.signal` to `fetch`;
5. clears the timeout in `finally`.

`probe()` currently catches any thrown error and has a special branch:

`if (e && e.name === "AbortError")`

That branch unconditionally:

- sets status to `cancelled-superseded`;
- clears lastError;
- decrements attempt;
- clears retryTimer;
- records R1144 cancellation reason `superseded`;
- returns without entering bounded failure/retry.

## 3. Verified authority gap

Tracing of the current R782 artifact-probe IIFE shows:

- no dedicated probe-level supersession controller;
- no `cancelProbe()` authority;
- no external signal passed into `fetchBuffer()`;
- no explicit supersession cause producer in the current artifact probe call chain;
- the visible `ctl.abort(...)` calls in this probe are owned by `fetchBuffer()` timeout handling.

Therefore the current catch rule:

> AbortError means intentional supersession

is not a valid authority contract.

It discards producer intent and can classify a timeout-originated abort as quiet supersession.

## 4. Invariants that must remain unchanged

The architecture must preserve:

- `tasun-version.json` as sole release/version authority;
- R782 exact manifest + alias + HTML build + SHA verification;
- parallel manifest/HTML network probe;
- non-blocking visual gate;
- local-first paint;
- cloud sync independence from release probe;
- bounded `MAX_RETRY` / existing retry delays;
- no `setInterval` polling;
- embedded bounded fallback after retry exhaustion;
- `online` lifecycle recheck;
- SelfHeal only invoking the existing probe authority, not owning a second probe loop.

No UI, formal data, permissions, login, sync, or row identity changes are authorized.

## 5. Architecture options

### Option A — Normalize all AbortError to timeout unless explicitly marked superseded at catch time

Keep `fetchBuffer()` mostly unchanged. In `probe()`, inspect error fields/message/signal reason and treat only specially marked supersession as quiet cancellation; all other AbortError cases become ordinary failures.

Advantages:
- small code change;
- fixes the immediate timeout misclassification.

Risks:
- catch layer must infer producer intent from error shape;
- browser differences in `fetch` abort propagation remain relevant;
- future abort producers can reintroduce ambiguity;
- responsibility remains in the wrong layer.

Assessment: not preferred.

### Option B — Producer-owned typed abort cause propagation

Make the abort producer classify its own cause before the error reaches `probe()`.

Recommended contract:

1. `fetchBuffer()` owns timeout classification.
2. Timeout expiry must surface a stable, explicit timeout result/error classification independent of how a browser names the underlying `fetch` abort exception.
3. A future intentional supersession source, if present, must pass or set an explicit supersession cause; it must not rely on generic `AbortError`.
4. `probe()` consumes the explicit cause:
   - `superseded` → quiet cancellation, no retry;
   - `timeout` → existing bounded failure/retry path;
   - other network/HTTP/SHA failures → existing bounded failure/retry path.
5. No new retry authority is created; `scheduleRetry()` remains the single retry authority.

Advantages:
- cause ownership stays with the producer;
- browser AbortError naming differences no longer decide semantics;
- preserves quiet cancellation when a real supersession producer exists;
- timeout behavior becomes deterministic;
- future abort causes can be extended without catch-layer guessing.

Risks:
- requires a small explicit abort-cause contract;
- tests must cover browsers that expose `AbortError`, `TimeoutError`, or `signal.reason`.

Assessment: **RECOMMENDED**.

### Option C — Remove special abort cancellation behavior entirely

Treat every abort as an ordinary failure/retry.

Advantages:
- simplest implementation;
- timeout problem disappears.

Risks:
- violates the approved R1144 quiet-cancellation contract if intentional supersession is introduced or already expected by external governance;
- can retry work that was deliberately superseded;
- loses useful cancellation semantics.

Assessment: reject.

## 6. Recommended architecture

**Option B — producer-owned typed abort cause propagation — APPROVED by user on 2026-10-11.**

Core rule:

> Abort semantics must be decided by the authority that causes the abort, not inferred from the generic exception name observed by the consumer.

Required semantic classes:

- `timeout`
- `superseded`
- ordinary failure

Only explicit `superseded` may enter quiet cancellation.

## 7. Proposed call-chain contract

Target architecture:

`probe(force)`
→ `fetchBuffer(...)`
→ network request

If timeout fires:

`fetchBuffer timeout authority`
→ abort underlying fetch
→ normalize to explicit `timeout` cause
→ throw/return classified failure
→ `probe`
→ existing error state
→ existing `scheduleRetry` if gate still requires convergence
→ bounded fallback when retry budget is exhausted.

If intentional supersession is requested:

`supersession producer`
→ explicit `superseded` cause
→ underlying abort if necessary
→ `probe`
→ quiet cancellation
→ no retry
→ attempt accounting remains non-failure.

No generic `AbortError` branch may by itself mean supersession.

## 8. Cause representation

The written spec may choose one concrete representation, but architecture requires an explicit stable contract.

Acceptable implementation forms include:

- a small custom error with `causeCode`;
- a normalized error object with a Tasun-owned field;
- an explicit result wrapper;
- an external signal reason mapped immediately by `fetchBuffer()`.

Required properties:

- deterministic across browsers;
- does not depend solely on `e.name`;
- timeout and supersession cannot collapse to the same code;
- ordinary errors retain existing message diagnostics;
- no second state authority outside the artifact probe.

## 9. Timeout behavior

Timeout is a retryable artifact-probe failure.

Required behavior:

- preserve `state.attempt` as a real failed attempt;
- preserve diagnostic `state.lastError`;
- preserve `__TASUN_REGISTER_R782_ARTIFACT_GATE_ERROR__`;
- if `mustConverge || !state.gateReleased` and attempt budget remains, use existing `scheduleRetry()`;
- after retry exhaustion and unreleased gate, use existing bounded embedded fallback;
- do not clear a valid existing retry solely because the underlying browser exception was named AbortError.

## 10. Supersession behavior

Intentional supersession remains quiet cancellation.

Required behavior:

- only an explicit producer-owned supersession cause qualifies;
- status may remain `cancelled-superseded`;
- do not count it as a failed attempt;
- do not schedule retry for the superseded operation;
- cancellation telemetry may retain `reason:"superseded"`;
- stale operation must not later release the gate.

Current tracing found no active supersession producer in the R782 probe chain. Therefore implementation must not invent a new supersession scheduler merely to justify this branch.

If no current supersession producer exists at implementation time, preserve the semantic hook but do not add a second controller/authority unless the written spec proves it is required.

## 11. Parallel probe behavior

The manifest and HTML fetches currently run under `Promise.all`.

Architecture must preserve parallelism.

If one side times out:

- the probe attempt is a timeout failure;
- existing retry/fallback policy applies.

The implementation must not introduce two independent retry loops for manifest and HTML.

The probe remains one attempt / one retry authority.

## 12. Lifecycle and gate behavior

Startup gate rules remain:

- page remains visually usable;
- artifact verification does not block local-first paint;
- unreleased gate must not become permanently stuck because a timeout abort was misclassified as supersession;
- `online` may trigger the existing lifecycle recheck;
- SelfHeal may invoke the existing probe, but must not create a parallel timer/poll loop.

## 13. Authority convergence

Authority retained:

- artifact probe: `probe()`;
- network primitive: `fetchBuffer()`;
- timeout producer: `fetchBuffer()`;
- retry: `scheduleRetry()`;
- gate release/fallback: `releaseGate()`;
- exact release identity: `tasun-version.json` / current R782 manifest contract.

Authority retired:

- generic `AbortError === superseded` assumption.

No new release authority, retry authority, or SelfHeal probe authority is permitted.

## 14. TDD plan

Before implementation, RED tests should prove:

1. timeout-originated abort cannot enter the supersession quiet-cancel branch;
2. timeout-originated abort increments/preserves failure attempt semantics;
3. timeout-originated abort enters existing bounded retry when the gate is unreleased;
4. explicit supersession remains quiet and does not retry;
5. generic AbortError without explicit supersession metadata is not sufficient to claim supersession;
6. parallel manifest + HTML probe remains one probe attempt with one retry authority;
7. no `setInterval` is introduced;
8. R782 exact manifest/alias/SHA contract remains unchanged.

Existing R1144 cancellation regression must remain GREEN.

## 15. Expected implementation boundary

Expected runtime target:

- `汐東收發文登錄表.html`

Expected test scope:

- new Issue #15 artifact-abort semantics tests;
- existing R1144 authority convergence tests;
- existing release/runtime regression tests.

Do not modify other formal pages unless tracing proves the exact same active artifact-probe implementation is duplicated and must be kept consistent.

## 16. Release impact

Implementation is expected to modify formal embedded JS and therefore is release-triggering.

After merge:

- Exact Auto Release required;
- build job required;
- GitHub Pages deploy required;
- deployed four-page build sequence / SHA verification required.

No manual version hardcoding.

Automatic release sequence numbers remain release identity only and must not be treated as the Issue #15 functional R-number.

## 17. Acceptance criteria

- [ ] timeout abort is deterministically classified as timeout;
- [ ] timeout uses the existing bounded retry/fallback path;
- [ ] intentional supersession remains quiet cancellation;
- [ ] generic AbortError alone is not treated as supersession;
- [ ] no second retry authority;
- [ ] no second probe authority;
- [ ] no polling;
- [ ] parallel probe preserved;
- [ ] exact manifest/alias/SHA contract preserved;
- [ ] startup gate cannot remain pending solely because timeout was misclassified;
- [ ] full regression GREEN;
- [ ] disposable exact release GREEN;
- [ ] final independent review has no blocking findings;
- [ ] formal Exact Auto Release GREEN;
- [ ] four-page deployed build/SHA verification GREEN.

## 18. Approval gate

Architecture:

- [x] user approved Option B on 2026-10-11

Written spec:

- [x] completed after architecture approval
- [x] explicitly approved by user on 2026-10-11

Implementation/TDD:

- [x] authorized by user on 2026-10-11

Written-spec approval is complete and implementation/TDD was authorized. Issue #15 has since completed implementation, formal release, deployed verification, and closure; closure evidence remains in Issue #15 and repository history.
