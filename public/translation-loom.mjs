import { ANCHORS, MODES, renderFragments, getAnchorCount } from "./translation-loom-core.mjs";

const modeInputs = [...document.querySelectorAll('input[name="mode"]')];
const anchorInputs = [...document.querySelectorAll('input[name="anchor"]')];
const rendered = document.querySelector("#rendered");
const modeTag = document.querySelector("#mode-tag");
const modeDescription = document.querySelector("#mode-description");
const anchorStatus = document.querySelector("#anchor-status");
const resetButton = document.querySelector("#reset");

function currentMode() {
  return modeInputs.find(input => input.checked)?.value ?? "symbolic";
}

function selectedAnchors() {
  return anchorInputs.filter(input => input.checked).map(input => input.value);
}

function render() {
  const modeId = currentMode();
  const mode = MODES[modeId];
  const selected = selectedAnchors();
  const fragments = renderFragments(modeId, selected);
  rendered.replaceChildren();

  if (fragments.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No anchors selected. The translation is intentionally empty; the source fragment has not changed.";
    rendered.append(empty);
  } else {
    for (const fragment of fragments) {
      const chip = document.createElement("span");
      chip.className = "fragment";
      chip.textContent = fragment.text;
      rendered.append(chip);
    }
  }

  modeTag.textContent = mode.label;
  modeDescription.textContent = mode.description;
  anchorStatus.textContent = `${getAnchorCount(selected)} of ${ANCHORS.length} demo-defined anchors are included.`;
}

for (const input of [...modeInputs, ...anchorInputs]) {
  input.addEventListener("change", render);
}

resetButton.addEventListener("click", () => {
  modeInputs.forEach(input => { input.checked = input.value === "symbolic"; });
  anchorInputs.forEach(input => { input.checked = true; });
  render();
});

render();