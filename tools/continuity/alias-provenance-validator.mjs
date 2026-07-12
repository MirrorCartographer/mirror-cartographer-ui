const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function validateAliasProvenance(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { valid: false, errors: ['record_must_be_object'] };
  if (typeof record.term !== 'string' || !record.term.trim()) errors.push('term_required');
  if (!Array.isArray(record.sources) || record.sources.length === 0) errors.push('sources_required');
  const sourceIds = new Set();
  for (const source of record.sources ?? []) {
    if (!source || typeof source !== 'object') { errors.push('source_must_be_object'); continue; }
    if (typeof source.id !== 'string' || !source.id.trim()) errors.push('source_id_required');
    else if (sourceIds.has(source.id)) errors.push('duplicate_source_id');
    else sourceIds.add(source.id);
    if (!validDate(source.observed_on)) errors.push('source_observed_on_invalid');
    if (!['repository', 'chat_summary', 'decision_log', 'artifact'].includes(source.type)) errors.push('source_type_invalid');
    if (source.contains_raw_private_content === true) errors.push('raw_private_content_forbidden');
  }
  if (!validDate(record.first_known_on)) errors.push('first_known_on_invalid');
  if (!validDate(record.last_seen_on)) errors.push('last_seen_on_invalid');
  if (validDate(record.first_known_on) && validDate(record.last_seen_on) && record.first_known_on > record.last_seen_on) errors.push('date_order_invalid');
  const dates = (record.sources ?? []).map(s => s?.observed_on).filter(validDate).sort();
  if (dates.length) {
    if (record.first_known_on !== dates[0]) errors.push('first_known_not_earliest_source');
    if (record.last_seen_on !== dates.at(-1)) errors.push('last_seen_not_latest_source');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
