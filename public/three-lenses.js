const lenses = [...document.querySelectorAll("[data-lens]")];
const actions = [...document.querySelectorAll("[data-action]")];
const lensNote = document.querySelector("#lens-note");
const actionNote = document.querySelector("#action-note");
const signal = document.querySelector("#signal-copy");
const originalSignal = signal.textContent;
lenses.forEach((button) => button.addEventListener("click", () => {
  lenses.forEach((item) => {
    const active = item === button;
    item.setAttribute("aria-pressed", String(active));
    item.querySelector("b").textContent = active ? "Selected lens" : "Select lens";
  });
  lensNote.textContent = button.dataset.explanation + " The observation stays unchanged.";
}));
actions.forEach((button) => button.addEventListener("click", () => {
  actions.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  actionNote.textContent = button.dataset.message;
}));
document.querySelector("#reset").addEventListener("click", () => {
  lenses.forEach((item) => {
    item.setAttribute("aria-pressed", "false");
    item.querySelector("b").textContent = "Select lens";
  });
  actions.forEach((item) => item.setAttribute("aria-pressed", "false"));
  signal.textContent = originalSignal;
  lensNote.textContent = "Choose any lens. The observation will remain exactly the same.";
  actionNote.textContent = "No next step selected. Leaving the question open is also valid.";
  lenses[0].focus();
});
