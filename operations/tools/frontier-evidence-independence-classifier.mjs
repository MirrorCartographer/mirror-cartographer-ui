const NON_EMPTY = /\S/;

function assertChannel(channel, index) {
  if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
    throw new TypeError(`channel ${index} must be an object`);
  }
  for (const field of ['method', 'authority', 'transport', 'operator']) {
    if (typeof channel[field] !== 'string' || !NON_EMPTY.test(channel[field])) {
      throw new Error(`channel ${index} ${field} missing`);
    }
  }
}

function uniqueCount(channels, field) {
  return new Set(channels.map((channel) => channel[field])).size;
}

export function classifyEvidenceIndependence(channels) {
  if (!Array.isArray(channels) || channels.length < 2) {
    throw new Error('at least two evidence channels are required');
  }
  channels.forEach(assertChannel);

  const dimensions = Object.freeze({
    method: uniqueCount(channels, 'method') === channels.length,
    transport: uniqueCount(channels, 'transport') === channels.length,
    operator: uniqueCount(channels, 'operator') === channels.length,
    authority: uniqueCount(channels, 'authority') === channels.length
  });

  let classification = 'duplicate_channel';
  if (dimensions.authority && dimensions.method) {
    classification = 'independent_authority_and_method';
  } else if (dimensions.authority) {
    classification = 'independent_authority_shared_method';
  } else if (dimensions.method) {
    classification = 'method_diverse_shared_authority';
  }

  return Object.freeze({
    channel_count: channels.length,
    dimensions,
    classification,
    source_independence_verified: dimensions.authority,
    method_diversity_verified: dimensions.method,
    claim_ceiling: dimensions.authority
      ? 'independent-source agreement'
      : dimensions.method
        ? 'independent-method agreement over a shared authority'
        : 'duplicate-channel agreement',
    deployment_claim_permitted: false
  });
}
