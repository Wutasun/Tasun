# Tasun Next-Cycle Written Spec Intake Gate

Date: 2026-10-11  
Repository: `Wutasun/Tasun`  
Status: INTAKE ONLY / NOT APPROVED / NO IMPLEMENTATION AUTHORITY

## 1. Locked baseline

The R1144 closure code-baseline trace point is:

`main @ 82b563a8902cc5aade20ba1eb7f2bcd3302d4e2e`

This trace point contains the completed R1144 closure record and remains aligned with the last verified formal release.

For every future functional cycle, create the implementation branch from the **latest current `main` at the moment the written spec is approved**. Do not branch from the historical trace-point SHA when `main` has advanced through documentation-only governance commits.

No implementation branch may use an older work branch, merged feature branch, or historical PR branch as its authority.

## 2. Fixed project rules

The next cycle must continue to preserve:

- Tasun v5 fixed global rules;
- TasunSelfHealV5;
- R268 unified self-heal standard;
- existing UI, page layout, and primary operation logic unless an approved requirement explicitly says otherwise;
- single formal data authority within the page lifecycle;
- dedupe-before-sync behavior;
- existing permission inheritance and identity contracts;
- `tasun-version.json` as the sole formal release-version authority;
- exact four-page release verification when formal pages are changed.

No second runtime authority, shadow state authority, compatibility patch authority, or manually hardcoded release version may be introduced.

## 3. Requirement intake

The following fields must be completed before a new functional R-number can be treated as approved scope.

### Problem statement

TBD — user requirement not yet supplied.

### Affected user flow

TBD.

### Affected formal pages / modules

TBD.

### Required behavior

TBD.

### Explicitly unchanged behavior

TBD.

### Data / identity / permission impact

TBD.

### Sync / cloud / lifecycle impact

TBD.

### Mobile / desktop impact

TBD.

### Release impact

TBD.

### Acceptance criteria

TBD.

## 4. Architecture decision gate

No architecture option is selected in this intake document.

Architecture work begins only after the requirement intake above is concrete enough to compare approaches.

The architecture decision must identify:

1. the existing original authority to modify;
2. any authority that must be retired;
3. call-chain and data-flow effects;
4. SelfHeal boundaries;
5. failure / abort / retry behavior;
6. how the design avoids duplicate or competing authorities.

## 5. Written spec approval gate

A future written spec is considered approved only when the user explicitly approves it.

Until that approval:

- do not create implementation code;
- do not create functional release changes;
- do not assign the automatic release sequence as the feature requirement number;
- do not infer scope from an old branch or old PR;
- do not reopen R1144.

## 6. Implementation / TDD gate

After written spec approval, proceed in this order:

1. create a fresh branch from the locked current `main`;
2. add RED tests for the approved requirement;
3. make the minimum change in the original authority;
4. reach GREEN;
5. run full Tasun regression;
6. run disposable exact-release verification where applicable;
7. review for duplicate authority / legacy residue;
8. create PR;
9. require CI GREEN;
10. merge using repository-allowed strategy;
11. run formal exact release if release-triggering files changed;
12. verify deployed four-page build sequence / SHA when applicable;
13. create closure / delivery record.

## 7. Current gate status

- R1144: CLOSED
- open Issues: 0 at gate creation
- open PRs: 0 at gate creation
- next functional requirement: NOT YET DEFINED
- next functional R-number: NOT YET ASSIGNED
- implementation authority: NONE until written spec approval

This document is a process gate only. It does not itself authorize any functional implementation.
