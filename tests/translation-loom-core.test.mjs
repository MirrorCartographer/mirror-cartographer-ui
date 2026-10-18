import test from "node:test";
import assert from "node:assert/strict";
import { ANCHORS, MODES, renderFragments, getAnchorCount } from "../public/translation-loom-core.mjs";

test("all three registers expose the same demo-defined anchor IDs", () => {
  const expected = ANCHORS.map(anchor => anchor.id);
  for (const modeId of Object.keys(MODES)) {
    assert.deepEqual(renderFragments(modeId, expected).map(item => item.id), expected);
  }
});

test("the wording changes across registers while anchor identity remains stable", () => {
  for (const anchor of ANCHORS) {
    assert.equal(new Set(Object.values(anchor.forms)).size, 3, `${anchor.id} should have distinct wording in each register`);
  }
});

test("removing an anchor removes only that fragment from the rendering", () => {
  const all = renderFragments("neutral", ANCHORS.map(anchor => anchor.id));
  const withoutContext = renderFragments("neutral", ["density", "separation"]);
  assert.equal(all.length, 3);
  assert.deepEqual(withoutContext.map(item => item.id), ["density", "separation"]);
});

test("an empty selection stays empty instead of inventing a substitute", () => {
  assert.deepEqual(renderFragments("symbolic", []), []);
});

test("unknown modes are rejected", () => {
  assert.throws(() => renderFragments("oracle", ["context"]), RangeError);
});

test("selection counting ignores unknown and duplicate IDs", () => {
  assert.equal(getAnchorCount(["context", "context", "not-an-anchor"]), 1);
});

test("research-register phrasing does not assert a diagnosis or cause", () => {
  const text = ANCHORS.map(anchor => anchor.forms.research).join(" ").toLowerCase();
  assert.match(text, /self-reported/);
  assert.doesNotMatch(text, /diagnosed|caused by|proves|is a disorder/);
});