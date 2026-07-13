export function validateCoverageReceipt(receipt) {
  const errors = [];
  const isObject = receipt && typeof receipt === 'object' && !Array.isArray(receipt);
  if (!isObject) return { valid: false, errors: ['receipt must be an object'] };

  const required = ['schema_version','receipt_id','repository','generated_at','tool_identity','target_identifiers','ref_inventory','history_traversal','source_classes','coverage_result','claim_transitions','privacy_boundary','known_exclusions','reproduction'];
  for (const key of required) if (!(key in receipt)) errors.push(`missing required field: ${key}`);

  if (receipt.schema_version !== 1) errors.push('schema_version must equal 1');
  if (!/^CM-COVERAGE-[0-9]{4,}$/.test(receipt.receipt_id ?? '')) errors.push('receipt_id is invalid');
  if (receipt.repository !== 'MirrorCartographer/mirror-cartographer-ui') errors.push('repository is invalid');
  if (typeof receipt.generated_at !== 'string' || Number.isNaN(Date.parse(receipt.generated_at))) errors.push('generated_at must be an ISO-8601 timestamp');

  const targets = receipt.target_identifiers;
  if (!Array.isArray(targets) || targets.length === 0 || targets.some(id => !/^M-[0-9]{3}$/.test(id))) {
    errors.push('target_identifiers are invalid');
  } else if (new Set(targets).size !== targets.length) {
    errors.push('target_identifiers must be unique');
  }

  const coverage = receipt.coverage_result;
  if (!['complete','incomplete','complete_with_declared_exclusions'].includes(coverage)) errors.push('coverage_result is invalid');
  if (!receipt.ref_inventory || typeof receipt.ref_inventory.complete !== 'boolean') errors.push('ref_inventory.complete must be boolean');
  if (!receipt.history_traversal || typeof receipt.history_traversal.complete !== 'boolean') errors.push('history_traversal.complete must be boolean');
  if (!Array.isArray(receipt.known_exclusions)) errors.push('known_exclusions must be an array');
  if (!Array.isArray(receipt.claim_transitions) || receipt.claim_transitions.length === 0) errors.push('claim_transitions must be a non-empty array');

  const refComplete = receipt.ref_inventory?.complete === true;
  const historyComplete = receipt.history_traversal?.complete === true;
  const exclusions = Array.isArray(receipt.known_exclusions) ? receipt.known_exclusions : [];
  if (coverage === 'complete') {
    if (!refComplete) errors.push('complete coverage requires complete ref inventory');
    if (!historyComplete) errors.push('complete coverage requires complete history traversal');
    if (exclusions.length !== 0) errors.push('complete coverage forbids known exclusions');
  }
  if (coverage === 'complete_with_declared_exclusions') {
    if (!refComplete) errors.push('complete_with_declared_exclusions requires complete ref inventory');
    if (!historyComplete) errors.push('complete_with_declared_exclusions requires complete history traversal');
    if (exclusions.length === 0) errors.push('complete_with_declared_exclusions requires at least one known exclusion');
  }
  if (coverage === 'incomplete' && refComplete && historyComplete && exclusions.length === 0) {
    errors.push('incomplete coverage contradicts complete ref and history traversal without exclusions');
  }

  const transitionIds = [];
  for (const transition of receipt.claim_transitions ?? []) {
    if (!/^M-[0-9]{3}$/.test(transition.identifier ?? '')) errors.push('claim transition identifier is invalid');
    else transitionIds.push(transition.identifier);
    if (!['unresolved','located','unlocated'].includes(transition.next_status)) errors.push(`invalid next_status for ${transition.identifier ?? 'unknown'}`);
    if (coverage === 'incomplete' && transition.next_status !== 'unresolved') errors.push(`incomplete coverage requires unresolved status for ${transition.identifier}`);
    if (transition.next_status === 'located' && !transition.immutable_locator) errors.push(`located transition requires immutable_locator for ${transition.identifier}`);
    if (transition.next_status === 'unlocated') {
      if (coverage !== 'complete') errors.push(`unlocated transition requires complete coverage for ${transition.identifier}`);
      if (receipt.ref_inventory?.complete !== true) errors.push(`unlocated transition requires complete ref inventory for ${transition.identifier}`);
      if (receipt.history_traversal?.complete !== true) errors.push(`unlocated transition requires complete history traversal for ${transition.identifier}`);
      if ((receipt.known_exclusions ?? []).length !== 0) errors.push(`unlocated transition forbids known exclusions for ${transition.identifier}`);
    }
  }

  if (transitionIds.length > 0) {
    if (new Set(transitionIds).size !== transitionIds.length) errors.push('claim transition identifiers must be unique');
    if (Array.isArray(targets) && targets.every(id => /^M-[0-9]{3}$/.test(id))) {
      const targetSet = new Set(targets);
      const transitionSet = new Set(transitionIds);
      const missing = [...targetSet].filter(id => !transitionSet.has(id));
      const extraneous = [...transitionSet].filter(id => !targetSet.has(id));
      if (missing.length > 0) errors.push(`claim transitions missing targets: ${missing.sort().join(', ')}`);
      if (extraneous.length > 0) errors.push(`claim transitions include undeclared targets: ${extraneous.sort().join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    const result = validateCoverageReceipt(JSON.parse(raw));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ valid: false, errors: [`invalid JSON: ${error.message}`] }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
