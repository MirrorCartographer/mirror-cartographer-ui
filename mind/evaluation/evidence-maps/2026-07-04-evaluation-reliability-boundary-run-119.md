# Evidence Map — Evaluation Reliability Boundary

Date: 2026-07-04
Run: Evidence Engine 119
Area: Mirror Cartographer / GitHub mind / evaluation governance

## Claim tested

Mirror Cartographer evaluation artifacts, checklists, and reviewer rubrics provide reliable evidence that the system is improving.

## Claim status update

Status: NARROWED / NOT YET PROVEN

Previous working assumption:
- If MC artifacts include evaluation criteria, checklists, and repeated review notes, then the repository has meaningful evidence of quality improvement.

Updated claim:
- MC evaluation artifacts provide meaningful evidence only when the evaluation method itself is reliable enough to reproduce: the rubric must be explicit, examples must be scored consistently, disagreements must be logged, and results must be linked to a concrete claim, design change, or falsification decision.

## Source quality

Primary or high-quality sources used:

1. NIST AI Risk Management Framework 1.0 and related NIST measurement framing.
   - Relevance: treats AI trustworthiness as a lifecycle risk-management and measurement problem, not as a one-time assertion.
   - Use in this map: supports the need for defined measurement methods, monitoring, uncertainty, and governance loops.

2. Stanford CRFM, Holistic Evaluation of Language Models (HELM).
   - Relevance: argues that model evaluation needs standardized scenarios, multiple metrics, transparency about what is missing, and shared raw artifacts.
   - Use in this map: supports multi-metric evaluation instead of single checklist pass/fail results.

3. Efficient Benchmarking of Language Models.
   - Relevance: shows that benchmark conclusions can change depending on evaluation design choices; introduces reliability/cost tradeoffs.
   - Use in this map: supports treating evaluation results as decision evidence with reliability limits, not as absolute proof.

4. Inter-rater reliability research on LLM and human qualitative coding.
   - Relevance: qualitative evaluation normally requires reliability checks between raters; LLM-as-rater must be validated against human coding rather than assumed equivalent.
   - Use in this map: supports requiring agreement statistics or structured disagreement review for MC qualitative audits.

## Evidence found

### Facts

- NIST frames trustworthy AI as risk management across the AI lifecycle, requiring organizations to govern, map, measure, and manage risks rather than merely document intentions.

- HELM identifies that language-model evaluation needs standardized scenarios and multiple metrics because accuracy alone does not capture calibration, robustness, fairness, bias, toxicity, efficiency, and other risk-relevant dimensions.

- HELM also emphasizes transparency of prompts, completions, scenarios, and metrics so other people can inspect or reproduce the evaluation.

- Efficient benchmarking research shows that benchmark design choices can affect reliability of conclusions; reducing examples or changing benchmark composition can change decisions unless reliability is explicitly evaluated.

- Inter-rater reliability research treats agreement between raters as a necessary quality check for qualitative coding; LLM-generated ratings require validation rather than blind acceptance.

### Inferences

- MC cannot claim that its evidence repository is improving merely because it contains more checklists, maps, or rubrics.

- A single AI-generated evaluation pass is weak evidence unless the same artifact can be re-scored by another evaluator, another model, or a human reviewer with similar results.

- For symbolic, health-adjacent, career, privacy, or safety-boundary outputs, disagreement is not noise; disagreement is evidence about ambiguous rubrics, unclear claims, or unstable evaluation procedures.

- The GitHub mind should distinguish between:
  - drafted evaluation criteria,
  - applied evaluations,
  - replicated evaluations,
  - disagreement-resolved evaluations,
  - and evaluations that triggered verified changes.

## Falsification checklist

Claim being falsified:
- "MC evaluation artifacts reliably show system improvement."

The claim should be downgraded or rejected if any of the following are true:

1. Two reviewers applying the same MC rubric to the same artifact produce materially different pass/fail judgments.
2. The rubric does not define observable pass/fail evidence.
3. The evaluation relies on impressions such as "feels coherent," "seems safe," or "looks aligned" without operational indicators.
4. The same artifact receives different results across repeated AI-review runs without explanation.
5. The evaluation does not separate fact, inference, metaphor, safety boundary, and user-editable interpretation.
6. The evaluation result is not linked to a claim-status update, design change, or decision to accept residual risk.
7. Evaluation failures are logged but not retested after correction.
8. No sample size, artifact selection rule, or scenario selection rule is recorded.

## Evaluation criterion added

### MC-EVAL-RELIABILITY-01

Every MC evaluation artifact must include:

1. Claim or component being evaluated.
2. Evaluation purpose: safety, usefulness, evidence quality, accessibility, career validity, privacy, health boundary, or symbolic clarity.
3. Rubric with observable criteria.
4. Test sample or artifact selection rule.
5. Scoring method.
6. Minimum acceptable evidence threshold.
7. At least one reliability check:
   - second human reviewer,
   - second AI reviewer with model/version noted,
   - repeated blind re-score,
   - or disagreement-resolution log.
8. Fact / inference / metaphor / recommendation separation check.
9. Failure handling rule.
10. Link to resulting claim-status update or system change.

Without item 7, the result should be labeled:
- provisional single-pass evaluation.

Without item 10, the result should be labeled:
- unclosed observation.

## Test plan

### MC-EVALUATION-RELIABILITY-PILOT-01

Goal:
- Determine whether MC evaluation rubrics produce reproducible judgments.

Sample:
- 20 existing GitHub mind artifacts:
  - 5 evidence maps,
  - 5 body-map or health-boundary outputs,
  - 5 career/opportunity artifacts,
  - 5 symbolic/reflection artifacts.

Procedure:
1. Select artifacts using a documented rule, not convenience selection.
2. Apply the current rubric once using AI evaluator A.
3. Apply the same rubric independently using AI evaluator B or a human reviewer.
4. Record criterion-level agreement and disagreement.
5. Identify rubric items with frequent disagreement.
6. Revise only the ambiguous rubric items.
7. Re-test on 5 held-out artifacts.
8. Update claim status based on whether agreement improves.

Suggested measures:
- Percent agreement by criterion.
- Disagreement count by artifact type.
- Number of failures that trigger concrete repository changes.
- Number of evaluations reclassified from "passed" to "provisional" because reliability was not tested.

Minimum standard for stronger claim:
- At least 80% criterion-level agreement on held-out artifacts, plus documented disagreement resolution for the remaining cases.

## Current conclusion

MC has the beginning of an evaluation culture, but not yet strong evidence that its evaluations are reliable. The next proof is not another checklist. The next proof is a reproducibility test of the checklist itself.

## Next proof needed

MC-EVALUATION-RELIABILITY-PILOT-01

Run a two-reviewer or repeated blind re-score test on 20 existing MC artifacts, measure agreement, revise ambiguous rubric criteria, and update the GitHub mind to classify prior evaluations as provisional, replicated, disagreement-resolved, or verified-change-producing.
