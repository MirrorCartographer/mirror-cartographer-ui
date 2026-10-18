export const MODES = Object.freeze({
  symbolic: Object.freeze({
    id: "symbolic",
    label: "Symbolic",
    description: "Metaphorical language can carry felt texture; it does not establish a literal greenhouse or a measurable mechanism."
  }),
  neutral: Object.freeze({
    id: "neutral",
    label: "Neutral",
    description: "A plain-language restatement is still an interpretation of the fictional source, not a verified measurement."
  }),
  research: Object.freeze({
    id: "research",
    label: "Research register",
    description: "Careful report-like wording can mark the kind of claim being made, but this fictional example contains no actual measurement or clinical conclusion."
  })
});

export const ANCHORS = Object.freeze([
  Object.freeze({
    id: "context",
    label: "Context",
    forms: Object.freeze({
      symbolic: "at midnight",
      neutral: "at night",
      research: "in an evening context"
    })
  }),
  Object.freeze({
    id: "density",
    label: "Multiplicity",
    forms: Object.freeze({
      symbolic: "every leaf is thinking",
      neutral: "thoughts feel numerous",
      research: "self-reported high thought density"
    })
  }),
  Object.freeze({
    id: "separation",
    label: "Separability",
    forms: Object.freeze({
      symbolic: "the leaves overlap until no single shape is easy to follow",
      neutral: "thoughts are difficult to separate",
      research: "difficulty distinguishing individual thoughts"
    })
  })
]);

export function renderFragments(modeId, selectedAnchorIds) {
  if (!Object.hasOwn(MODES, modeId)) {
    throw new RangeError(`Unknown translation mode: ${modeId}`);
  }
  if (!Array.isArray(selectedAnchorIds)) {
    throw new TypeError("selectedAnchorIds must be an array");
  }
  const selected = new Set(selectedAnchorIds);
  return ANCHORS
    .filter(anchor => selected.has(anchor.id))
    .map(anchor => Object.freeze({
      id: anchor.id,
      label: anchor.label,
      text: anchor.forms[modeId]
    }));
}

export function getAnchorCount(selectedAnchorIds) {
  if (!Array.isArray(selectedAnchorIds)) {
    throw new TypeError("selectedAnchorIds must be an array");
  }
  const known = new Set(ANCHORS.map(anchor => anchor.id));
  return new Set(selectedAnchorIds.filter(id => known.has(id))).size;
}