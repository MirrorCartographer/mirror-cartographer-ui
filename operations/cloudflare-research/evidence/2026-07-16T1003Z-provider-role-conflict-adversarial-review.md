# Cloudflare provider-role conflict adversarial review

## Scope and claim boundary

This cycle used read-only repository inspection plus one reversible policy artifact on `preview`. It did not modify workflows, deployments, DNS, credentials, schedules, automations, production infrastructure, shared state, or irreversible user data. It proves a provider-role contradiction was identified and recorded; it does not prove any provider deployment succeeded.

## Checkpoint 1 — before deployment or architectural commitment

**Claim or design tested:** Cloudflare can be assigned a publication role without first reconciling current Vercel and GitHub Pages behavior.

**Challenge method:** Inspected exact diffs for default-branch commits `5c91a8d7555608e8560fb3deb0b5529c5140f9f1`, `95ccf6011b984b1ce8dce347cf225eedc49ca643`, and `b740963fa6cf6d2c3dc7a069c36e0645685b1928`; compared them with `preview:operations/CURRENT_STATE.json` and the stronger preview promotion checklist.

**Evidence:** The deployment policy explicitly says the Vercel Studio Team owns preview verification and promotion evidence. The GitHub Pages workflow independently deploys every push to `main` and permits manual dispatch. The preview branch is 66 commits ahead of `main`, so a future promotion or direct main push can trigger Pages even though no evidence shows Pages is integrated with the Vercel-owned promotion gate. Canonical state remains Vercel-blocked, and no Cloudflare role is assigned.

**Failures or counterexamples found:**

- Provider-role conflict: Vercel is declared promotion authority while GitHub Pages is an active main-branch publisher.
- Promotion-bypass possibility: a direct push or manual workflow dispatch can publish through Pages without demonstrating the Vercel evidence contract.
- Multi-provider ambiguity: no precedence, domain ownership, evidence-equivalence, or rollback semantics reconcile Vercel and Pages.
- Cloudflare adoption would create a third unresolved publication authority.
- Commit titles alone remain insufficient to prove a successful Pages deployment.

**Repairs made:** Rejected Cloudflare adoption for this cycle and chose a provider-neutral, fail-closed role matrix as the smallest reversible repair.

**Remaining uncertainty:** Whether GitHub Pages is enabled at repository settings level, whether the workflow has executed successfully, its current hostname/domain, and whether Vercel currently serves the canonical user-facing surface.

**Rollback route:** Revert the policy-artifact commit; no runtime rollback is required.

**Robustness increased:** Yes. The contradiction is now explicit rather than inferred from scattered files.

**Next falsifiable step:** Retrieve exact commit-matched workflow runs and deployment artifacts for the Pages workflow and reconcile them with authenticated Vercel project/deployment metadata without triggering a deployment.

## Checkpoint 2 — immediately after implementation

**Claim or design tested:** `operations/deployment/PROVIDER_ROLE_MATRIX.json` safely resolves the immediate architecture ambiguity without duplicating existing validators or changing live provider behavior.

**Challenge method:** Attempted to falsify the matrix using role substitution, missing-state, cancellation, branch mismatch, commit mismatch, and rollback counterexamples. Checked whether the artifact accidentally grants Cloudflare authority, represents declared policy as runtime proof, or permits two canonical publishers.

**Evidence:** Policy artifact commit `f8419ae752f5cbc97ddc5b348430729c3dfa0a08`; fetched blob `168d198d19b91785b8c877f837fdf35a78f90576`. The artifact marks Vercel as declared but runtime-unverified, GitHub Pages as blocked pending reconciliation, and Cloudflare as having no publication role. It classifies absent, queued, building, canceled, skipped, superseded, rate-limited, stale, commit-mismatched, branch-mismatched, repository-mismatched, project-mismatched, and authority-unresolved states as non-success.

**Failures or counterexamples found:**

- A role matrix alone cannot stop the existing Pages workflow on `main`.
- The artifact is not yet invoked by the promotion validator or any workflow.
- `artifact_commit_binding` is a requirement label, not executed commit-binding enforcement.
- A future actor could ignore the matrix unless canonical verification consumes it fail-closed.

**Repairs made:** Kept the matrix explicitly provisional and fail-closed; did not claim enforcement; blocked all publication and promotion; required one explicit authority or a documented multi-provider precedence model.

**Remaining uncertainty:** No consumer inventory exists for deployment policy files; no proof shows the matrix is canonical or enforced.

**Rollback route:** Revert `f8419ae752f5cbc97ddc5b348430729c3dfa0a08`.

**Robustness increased:** Yes at the policy and reasoning layer; no runtime robustness increase is claimed.

**Next falsifiable step:** Add a disposable validator fixture that rejects publication when more than one provider is authoritative or when an active publisher lacks promotion-gate integration, then execute it at an exact commit before canonical adoption.

## Checkpoint 3 — verification before declaring success

**Claim or design tested:** The Cloudflare design or any publication path can be declared successful.

**Challenge method:** Required authenticated provider identity, exact repository/project/branch/commit agreement, successful non-stale deployment state, hostname/domain authority, quota and cancellation state, promotion-gate integration, and tested rollback. Explicitly treated missing, queued, building, canceled, skipped, superseded, rate-limited, stale, commit-mismatched, branch-mismatched, project-mismatched, repository-mismatched, and authority-unresolved evidence as non-success.

**Evidence:** Repository diffs and policy blobs only. No authenticated Cloudflare project object, Vercel deployment object, GitHub Pages workflow run, Pages deployment object, generated hostname, domain mapping, quota status, or executed rollback evidence was available.

**Failures or counterexamples found:** Source policy cannot establish provider runtime state. The main-branch Pages workflow introduces a possible publication path that is not proven to consume the preview promotion gate. Cloudflare has no authorized role and therefore cannot be promoted even if a technically valid deployment existed.

**Repairs made:** Deployment evidence classified as absent/non-success. Publication and promotion remain blocked. No deployment experiment was run because provider authority is unresolved.

**Remaining uncertainty:** Exact live provider serving state, Pages workflow history and cancellation state, Vercel project identity and capacity, canonical domain ownership, and whether any external provider currently serves stale code.

**Rollback route:** Revert this evidence commit and `f8419ae752f5cbc97ddc5b348430729c3dfa0a08`; no production rollback applies.

**Robustness increased:** Yes. The verification boundary now distinguishes policy evidence from deployment evidence and blocks authority substitution.

**Next falsifiable step:** Perform read-only, exact-commit reconciliation of GitHub Pages workflow runs/deployments and Vercel project/deployment metadata; then choose one canonical publisher or define tested multi-provider precedence before any Cloudflare experiment.

## Run conclusion

**Strongest surviving Cloudflare design:** Cloudflare remains non-authoritative and fail-closed. The immediate architecture should use one provider-role matrix: Vercel is the declared but runtime-unverified promotion authority; GitHub Pages is an unreconciled publisher blocked from being treated as canonical; Cloudflare has no publication role. No provider may publish the canonical surface until exactly one authority is established or a multi-provider design specifies precedence, domain ownership, equivalent commit-bound evidence, cancellation semantics, and rollback behavior.

**Rejected alternatives:** Assigning Cloudflare a role before reconciliation; treating the Pages workflow file or commit title as deployment success; allowing Pages to bypass the preview gate; adding another overlapping deployment validator without provider authority; triggering deployments merely to discover configuration; treating missing or canceled evidence as success.

**Unresolved risks:** Existing main-branch Pages auto-publication, manual dispatch bypass, provider-policy drift, unknown live provider/domain state, unknown quota and cancellation states, untested rollback, and lack of canonical enforcement for the role matrix.

**Deployment evidence status:** Absent; non-success.

**Publication or promotion decision:** Blocked.
