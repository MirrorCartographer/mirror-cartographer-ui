'use strict';

const REQUIRED_REPERTORY_TESTS = Object.freeze([
  'assessCurlBoundRepertoryPublicationReadiness.v1.test.cjs',
  'assessRepertoryActivation.v1.test.cjs',
]);

function assessRepertoryTestInventory(discoveredNames, requiredNames = REQUIRED_REPERTORY_TESTS) {
  const discovered = Array.isArray(discoveredNames) ? discoveredNames : [];
  const required = Array.isArray(requiredNames) ? requiredNames : [];
  const violations = [];

  const normalizedDiscovered = discovered
    .filter((name) => typeof name === 'string')
    .map((name) => name.trim())
    .filter(Boolean);
  const normalizedRequired = required
    .filter((name) => typeof name === 'string')
    .map((name) => name.trim())
    .filter(Boolean);

  if (normalizedDiscovered.length !== discovered.length) {
    violations.push('invalid_discovered_test_name');
  }
  if (normalizedRequired.length !== required.length || normalizedRequired.length === 0) {
    violations.push('invalid_required_test_inventory');
  }

  const duplicateDiscovered = normalizedDiscovered.filter(
    (name, index) => normalizedDiscovered.indexOf(name) !== index,
  );
  const duplicateRequired = normalizedRequired.filter(
    (name, index) => normalizedRequired.indexOf(name) !== index,
  );

  if (duplicateDiscovered.length > 0) violations.push('duplicate_discovered_test_name');
  if (duplicateRequired.length > 0) violations.push('duplicate_required_test_name');

  const missingRequired = normalizedRequired.filter(
    (name) => !normalizedDiscovered.includes(name),
  );
  if (missingRequired.length > 0) violations.push('required_repertory_test_missing');
  if (normalizedDiscovered.length === 0) violations.push('no_repertory_tests_discovered');

  return {
    schema_version: 1,
    verified: violations.length === 0,
    discovered_count: normalizedDiscovered.length,
    required_count: normalizedRequired.length,
    required_tests: [...normalizedRequired].sort(),
    missing_required_tests: [...missingRequired].sort(),
    violations: [...new Set(violations)].sort(),
    claim_boundary: violations.length === 0
      ? 'required_repertory_tests_present_before_execution'
      : 'repertory_test_execution_prohibited',
  };
}

module.exports = {
  REQUIRED_REPERTORY_TESTS,
  assessRepertoryTestInventory,
};
