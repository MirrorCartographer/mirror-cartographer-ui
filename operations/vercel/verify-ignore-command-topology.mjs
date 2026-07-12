export function auditIgnoreCommandSource(source) {
  const usesSingleParentDiff =
    /git[^\n]*diff[^\n]*HEAD\^['"\s,)]*HEAD/u.test(source) ||
    /\['diff',\s*'--name-only',\s*'HEAD\^',\s*'HEAD'\]/u.test(source);
  const usesMergeAwareDiff =
    /diff-tree/u.test(source) && /(?:^|[,'"\s])-m(?:$|[,'"\s])/u.test(source);

  const risks = [];
  if (usesSingleParentDiff && !usesMergeAwareDiff) {
    risks.push('single-parent-diff-can-miss-merge-parent-changes');
  }

  return {
    valid: risks.length === 0,
    risks,
    observed: { usesSingleParentDiff, usesMergeAwareDiff },
  };
}
