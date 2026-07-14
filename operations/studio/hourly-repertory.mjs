const REQUIRED_CAPABILITIES = Object.freeze({
  accessible: true,
  mobile_safe: true,
  non_autoplaying: true,
  reversible: true,
});

export const REPERTORY = Object.freeze([
  Object.freeze({
    id: 'wordless-sky',
    title: 'Wordless Sky',
    form: 'instrument',
    continuity_channel: 'shared_continuity_v1',
    visual_grammar: 'weather, touch traces, luminous score',
    provenance: Object.freeze({
      observed: ['current production uses a wordless sky instrument'],
      inferred: ['weather can function as an emotional-spatial stage language'],
      experiment: ['hourly repertory slot 0'],
      current_decision: 'retain as the continuity anchor production',
    }),
    capabilities: REQUIRED_CAPABILITIES,
  }),
  Object.freeze({
    id: 'archive-afterimage',
    title: 'Archive Afterimage',
    form: 'film',
    continuity_channel: 'shared_continuity_v1',
    visual_grammar: 'retained marks, delayed echoes, quiet cuts',
    provenance: Object.freeze({
      observed: ['project treats prior work as an archive and continuity substrate'],
      inferred: ['memory should appear as residue rather than explanatory text'],
      experiment: ['hourly repertory slot 1'],
      current_decision: 'stage memory as visual persistence without exposing source material',
    }),
    capabilities: REQUIRED_CAPABILITIES,
  }),
  Object.freeze({
    id: 'coordinate-carnival',
    title: 'Coordinate Carnival',
    form: 'stage',
    continuity_channel: 'shared_continuity_v1',
    visual_grammar: 'hand-drawn coordinates, orbital type, restrained carnival motion',
    provenance: Object.freeze({
      observed: ['project history contains hand-drawn, carnival, orbital, and coordinate aesthetics'],
      inferred: ['these motifs can coexist as a stage rather than a product interface'],
      experiment: ['hourly repertory slot 2'],
      current_decision: 'use as a distinct production, not as the permanent house style',
    }),
    capabilities: REQUIRED_CAPABILITIES,
  }),
  Object.freeze({
    id: 'silent-switchboard',
    title: 'Silent Switchboard',
    form: 'interface',
    continuity_channel: 'shared_continuity_v1',
    visual_grammar: 'signals, pathways, state transitions, no dashboard chrome',
    provenance: Object.freeze({
      observed: ['Mirror Cartographer is treated as an engine and operating system'],
      inferred: ['system state can be performed as an instrument rather than displayed as administration'],
      experiment: ['hourly repertory slot 3'],
      current_decision: 'keep operational meaning implicit and publicly safe',
    }),
    capabilities: REQUIRED_CAPABILITIES,
  }),
]);

export function repertoryHourKey(input = Date.now()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid date or timestamp is required.');
  return Math.floor(date.getTime() / 3_600_000);
}

export function productionForHour(input = Date.now(), repertory = REPERTORY) {
  if (!Array.isArray(repertory) || repertory.length === 0) {
    throw new TypeError('Repertory must contain at least one production.');
  }
  const hourKey = repertoryHourKey(input);
  const index = ((hourKey % repertory.length) + repertory.length) % repertory.length;
  return Object.freeze({
    ...repertory[index],
    repertory_index: index,
    hour_key: hourKey,
  });
}

export function validateRepertory(repertory = REPERTORY) {
  const ids = new Set();
  return repertory.every((production) => {
    if (!production?.id || ids.has(production.id)) return false;
    ids.add(production.id);
    if (production.continuity_channel !== 'shared_continuity_v1') return false;
    return Object.entries(REQUIRED_CAPABILITIES).every(
      ([key, expected]) => production.capabilities?.[key] === expected,
    );
  });
}
