export function createCompositionFrame(clock, input = {}) {
  const projected = clock?.snapshot?.({
    now: input.now,
    state: input.state,
    pulse: input.pulse,
    rhythm: input.rhythm,
  });

  if (!projected) return null;

  return {
    state: projected.state,
    pulse: projected.energy,
    rhythm: Number.isFinite(input.rhythm) ? input.rhythm : 0,
    beat: projected.beat,
    phase: projected.phase,
    phrase: projected.phrase,
  };
}

export function createTapCompositionFrame(clock, input = {}) {
  const projected = clock?.tap?.({
    now: input.now,
    state: input.state,
    pulse: input.pulse,
    rhythm: input.rhythm,
  });

  if (!projected) return null;

  return {
    state: projected.state,
    pulse: projected.energy,
    rhythm: Number.isFinite(input.rhythm) ? input.rhythm : 0,
    beat: projected.beat,
    phase: projected.phase,
    phrase: projected.phrase,
  };
}
