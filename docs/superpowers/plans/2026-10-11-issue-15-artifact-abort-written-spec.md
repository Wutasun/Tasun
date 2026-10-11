# Issue #15 — Artifact Abort Semantics Written Spec

Date: 2026-10-11  
Requirement: GitHub Issue #15 — `[REQ] Distinguish artifact supersession AbortError from timeout retry`  
Architecture: Option B — APPROVED  
Functional R-number: NOT ASSIGNED  
Status: WRITTEN SPEC APPROVED / IMPLEMENTATION-TDD AUTHORIZED

## 1. Objective

Correct the register-page artifact probe so abort semantics are determined by the producer-owned cause rather than by the generic browser exception name.

The implementation must ensure:

1. timeout-originated aborts are classified as `timeout`;
2. timeout-originated aborts enter the existing bounded failure/retry/fallback path;
3. only explicit intentional supersession qualifies for quiet cancellation;
4. a generic `AbortError` without explicit Tasun-owned supersession metadata is never sufficient to claim supersession;
5. no second artifact probe, retry loop, release authority, or polling mechanism is created.

## 2. Baseline authority

Architecture tracing baseline:

`main @ 0577989e0f9cca514e120b10c1ed2228d2f4192b`

At implementation approval time, create the implementation branch from the latest current `main`, not from this documentation branch.

Retained authorities:

- artifact probe authority: `probe(force)`;
- network fetch primitive: `fetchBuffer(url, timeoutMs, label)`;
- timeout producer: `fetchBuffer()`;
- retry authority: `scheduleRetry(reason)`;
- gate release/fallback authority: `releaseGate(status, entry, verified)`;
- exact manifest/alias/SHA authority: existing R782 contract;
- release/version authority: `tasun-version.json`.

## 3. In-scope runtime file

Primary expected runtime target:

- `汐東收發文登錄表.html`

Expected test scope:

- one new Issue #15-focused test file if needed;
- existing R1144 authority-convergence tests;
- existing release/runtime regression tests.

Other formal pages must not be changed unless implementation tracing proves they contain the same active artifact-probe authority and consistency requires it.

## 4. Explicit non-goals

This requirement does not change:

- visible UI;
- form fields;
- row data;
- `uid / rev / updatedAt / deleted`;
- login or permission inheritance;
- cloud sync authority;
- R852/R863 transport behavior;
- exact manifest alias contract;
- HTML SHA verification;
- local-first paint;
- visual gate behavior;
- Exact Auto Release sequence generation;
- `tasun-version.json` ownership;
- retry count or delay policy unless a RED test proves the existing values themselves are defective.

It also does not introduce a new functional R-number.

## 5. Existing defect

Current `fetchBuffer()` owns a timeout `AbortController`.

On timeout it calls `ctl.abort(reason)`, but browsers may surface the resulting fetch rejection as:

- `AbortError`;
- `TimeoutError`;
- the signal reason;
- another implementation-specific abort-shaped error.

Current `probe()` contains:

`if (e && e.name === "AbortError")`

and treats all such errors as `cancelled-superseded`.

This violates producer-owned cause semantics.

## 6. Tasun-owned abort cause contract

The implementation must use one explicit Tasun-owned field:

`tasunArtifactAbortCause`

Allowed values for this requirement:

- `"timeout"`
- `"superseded"`

Ordinary failures have no Tasun abort cause.

The field name must be stable and covered by tests.

Generic exception names such as `AbortError` and `TimeoutError` may remain diagnostic, but they are not semantic authority.

## 7. Error normalization helper

Add one small private helper within the existing R782 artifact-probe IIFE, for example:

`r15ArtifactAbortError(cause, label, originalError)`

Required behavior:

- returns an `Error`-compatible object;
- sets `tasunArtifactAbortCause` to the supplied explicit cause;
- preserves a useful message;
- preserves/attaches original error only for diagnostics if safe;
- does not create global mutable state;
- does not become a second retry or probe authority.

Exact helper naming may differ, but tests must assert the explicit cause contract.

## 8. fetchBuffer timeout contract

`fetchBuffer()` remains the timeout producer.

Required implementation shape:

1. create existing local `AbortController`;
2. create local boolean or equivalent state such as `timedOut=false`;
3. when timeout callback fires:
   - set `timedOut=true`;
   - abort the underlying fetch;
4. wrap the network `fetch/arrayBuffer` work in `try/catch/finally`;
5. in `catch(e)`:
   - if `timedOut===true`, throw a normalized error whose
     `tasunArtifactAbortCause==="timeout"`;
   - otherwise rethrow the original error unless it already contains an explicit Tasun-owned abort cause;
6. in `finally`, clear the timeout.

This makes timeout classification deterministic regardless of browser exception naming.

## 9. Supersession contract

Current tracing found no active supersession producer in the R782 artifact-probe chain.

Therefore this implementation must **not invent a new supersession controller**.

The semantic hook remains supported:

- if an error reaches `probe()` with
  `tasunArtifactAbortCause==="superseded"`,
  it qualifies for quiet cancellation.

No other condition qualifies.

Specifically, these are insufficient by themselves:

- `e.name==="AbortError"`;
- `e.name==="TimeoutError"`;
- message text containing `abort`;
- presence of an `AbortSignal`;
- browser-specific abort exception classes.

## 10. probe catch classification order

`probe()` catch handling must follow this order.

### 10.1 Explicit supersession

If:

`e?.tasunArtifactAbortCause === "superseded"`

then:

- set `state.status="cancelled-superseded"`;
- clear `state.lastError`;
- decrement/revert attempt accounting so this does not count as a failed probe;
- do not schedule retry for this superseded operation;
- keep R1144 cancellation telemetry with reason `superseded`;
- return false.

### 10.2 Timeout

If:

`e?.tasunArtifactAbortCause === "timeout"`

then it must **not** enter quiet cancellation.

Instead it enters the same failure block as ordinary network failures:

- `state.lastError` becomes a stable timeout diagnostic;
- `__TASUN_REGISTER_R782_ARTIFACT_GATE_ERROR__` is written;
- the failed attempt remains counted;
- if `mustConverge || !state.gateReleased` and `state.attempt < MAX_RETRY`, call existing `scheduleRetry(state.lastError)`;
- if retry budget is exhausted and gate is unreleased, call existing bounded embedded fallback.

### 10.3 Generic AbortError

A generic `AbortError` without explicit `tasunArtifactAbortCause` is treated as an ordinary failure.

It must not enter the supersession branch.

This protects against browser-specific abort propagation and future unknown abort producers.

### 10.4 Ordinary failures

HTTP, parse, alias, build mismatch, SHA mismatch, network, and other failures continue using the current bounded failure/retry/fallback behavior.

## 11. Attempt accounting

Required accounting:

- successful exact artifact verification → `state.attempt=0` as today;
- timeout failure → failed attempt remains counted;
- generic AbortError without explicit supersession → failed attempt remains counted;
- explicit supersession → does not count as a failed attempt.

The implementation must not decrement attempts for timeout.

## 12. Retry authority

`scheduleRetry()` remains the single retry authority.

No new:

- retry timer;
- retry queue;
- per-fetch retry loop;
- manifest-only retry;
- HTML-only retry;
- SelfHeal retry loop

may be added.

Timeout and ordinary failure both re-enter through `scheduleRetry()`.

Existing `MAX_RETRY` and `RETRY_DELAYS` remain unchanged unless separately approved.

## 13. Parallel manifest + HTML probe contract

The existing:

`Promise.all([fetchBuffer(VERSION_URL,...), fetchBuffer(PAGE_FILE,...)])`

must remain parallel.

A timeout in either child fetch causes the current probe attempt to fail as one attempt.

Do not add independent retry state for each child.

The next attempt again probes both manifest and HTML through the existing one probe authority.

## 14. Gate behavior

The visual/startup gate contract remains:

- body remains visible and interactive;
- local-first paint is preserved;
- cloud sync is independent from release probe;
- exact verification may complete later;
- timeout cannot silently leave the gate pending with no retry solely because the browser surfaced `AbortError`;
- after bounded retry exhaustion, existing embedded fallback still releases the gate.

## 15. Lifecycle behavior

Existing lifecycle triggers remain:

- startup idle/fallback probe;
- `online` recheck;
- SelfHeal bounded repair invocation.

No new page lifecycle event is required.

SelfHeal may call the existing `probe(false)` authority but must not classify abort causes independently.

## 16. Telemetry contract

Existing telemetry remains, with timeout represented as failure rather than supersession.

Required:

- explicit supersession may continue writing
  `__TASUN_REGISTER_R1144_ARTIFACT_CANCELLATION__`;
- timeout must write
  `__TASUN_REGISTER_R782_ARTIFACT_GATE_ERROR__`;
- timeout must not write cancellation reason `superseded`.

Optional additional scalar-only timeout telemetry is allowed only if it does not become state authority.

## 17. TDD specification

Implementation must follow RED → GREEN.

### 17.1 RED — timeout cause normalization

Add a test proving the timeout producer creates/propagates:

`tasunArtifactAbortCause === "timeout"`

independent of generic browser exception name.

Pre-fix: FAIL.

Post-fix: PASS.

### 17.2 RED — timeout does not quiet-cancel

Test the `probe()` catch contract and assert timeout cannot reach:

`state.status="cancelled-superseded"`.

Pre-fix: FAIL.

Post-fix: PASS.

### 17.3 RED — timeout retains failed-attempt semantics

Assert timeout path does not decrement `state.attempt`.

### 17.4 RED — timeout uses existing retry

Assert timeout path reaches existing `scheduleRetry()` when:

- gate is unreleased or convergence is required;
- retry budget remains.

No second timer may be introduced.

### 17.5 RED — explicit supersession stays quiet

Inject/construct an error with:

`tasunArtifactAbortCause="superseded"`

and assert:

- no retry;
- no failed-attempt accounting;
- cancellation telemetry remains `superseded`.

### 17.6 RED — generic AbortError is not supersession

Construct a generic error with:

`name="AbortError"`

but no Tasun cause.

Assert it uses ordinary failure handling.

### 17.7 RED — exact release contract unchanged

Assert:

- parallel `Promise.all` remains;
- `VERSION_URL` and `PAGE_FILE` are still both probed;
- SHA256 verification remains;
- alias atomicity remains;
- `scheduleRetry` remains singular;
- no `setInterval`.

## 18. GREEN implementation boundary

Expected minimum runtime changes:

1. add one private abort normalization helper;
2. update `fetchBuffer()` timeout path to mark producer-owned timeout state and normalize the thrown error;
3. change `probe()` quiet-cancel test from generic `AbortError` to explicit
   `tasunArtifactAbortCause==="superseded"`;
4. allow timeout and generic AbortError to fall through existing failure/retry logic;
5. add Issue #15 tests.

Do not refactor unrelated R782 logic.

## 19. Implementation invariants

Implementation is invalid if it:

- adds a second probe authority;
- adds a second retry timer/loop;
- adds `setInterval`;
- creates a fake supersession controller with no current caller;
- treats generic AbortError as supersession;
- changes manifest alias semantics;
- weakens SHA verification;
- changes page visibility/gate UI behavior;
- changes cloud sync behavior;
- changes formal row data;
- manually hardcodes a release version;
- modifies `tasun-version.json` by hand.

## 20. Verification sequence

Before PR merge:

1. Issue #15 tests GREEN;
2. R1144 authority-convergence tests GREEN;
3. release/runtime regression GREEN;
4. embedded script syntax checks GREEN;
5. disposable exact-release verification GREEN;
6. independent Codex review has no blocking finding;
7. changed-file review confirms only approved runtime/tests/docs scope;
8. confirm no manual `tasun-version.json` edit.

After merge:

9. Exact Auto Release runs;
10. build job succeeds;
11. GitHub Pages deploy succeeds;
12. deployed four-page build sequence verification succeeds;
13. deployed four-page SHA verification succeeds;
14. Issue #15 closure record is created.

## 21. Acceptance criteria

- [ ] timeout has explicit Tasun-owned cause;
- [ ] timeout never enters quiet supersession by exception name alone;
- [ ] timeout remains a failed attempt;
- [ ] timeout uses existing bounded retry/fallback;
- [ ] explicit supersession remains quiet and non-retrying;
- [ ] generic AbortError without explicit cause is ordinary failure;
- [ ] parallel manifest/HTML probe preserved;
- [ ] one probe authority preserved;
- [ ] one retry authority preserved;
- [ ] no polling;
- [ ] exact alias/build/SHA verification preserved;
- [ ] local-first visual gate preserved;
- [ ] full regression GREEN;
- [ ] disposable exact release GREEN;
- [ ] independent review GREEN;
- [ ] formal Exact Auto Release GREEN;
- [ ] four-page deployed build/SHA verification GREEN.

## 22. Approval gate

Architecture:

- [x] Option B approved by user on 2026-10-11

Written spec:

- [x] explicitly approved by user on 2026-10-11

Implementation/TDD:

- [x] authorized by user on 2026-10-11

Written spec approval is complete. Implementation/TDD is authorized, but must begin from the latest current main after this approved spec is merged. Functional R-number remains unassigned unless separately approved.
