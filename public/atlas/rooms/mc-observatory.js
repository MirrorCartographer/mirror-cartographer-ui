/* Mirror Cartographer first-party interaction observatory.
   Local-only: no network requests, no text-field values, no pointer coordinates, and no personal identifiers. A random session token is stored only in this browser's sessionStorage. */
(() => {
  if (window.__MC_LOCAL_OBSERVATORY__) return;
  window.__MC_LOCAL_OBSERVATORY__ = true;
  const KEY = "mc:observatory:v1";
  const LIMIT = 1200;
  const path = location.pathname.replace(/\/+/g, "/");
  const route = path.split("/").filter(Boolean).slice(-3).join("/") || "home";
  const session = (() => {
    try {
      const key = "mc:observatory:session";
      let value = sessionStorage.getItem(key);
      if (!value) { value = (crypto.randomUUID?.() || String(Date.now()) + Math.random()); sessionStorage.setItem(key, value); }
      return value;
    } catch { return "session-unavailable"; }
  })();
  const read = () => { try { const x = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(x) ? x : []; } catch { return []; } };
  const write = rows => { try { localStorage.setItem(KEY, JSON.stringify(rows.slice(-LIMIT))); } catch {} };
  const emit = (type, detail = {}) => {
    const rows = read();
    rows.push({v:1, at:Date.now(), session, route, type, ...detail});
    write(rows);
  };
  let activeStarted = document.visibilityState === "visible" ? Date.now() : 0;
  let activeMs = 0;
  let finished = false;
  emit("page_view", {title: document.title.slice(0,100)});
  const flushActive = () => {
    if (activeStarted) { activeMs += Math.max(0, Date.now() - activeStarted); activeStarted = 0; }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { if (!activeStarted) activeStarted = Date.now(); emit("visibility", {state:"visible"}); }
    else { flushActive(); emit("visibility", {state:"hidden"}); }
  });
  const finish = () => { if (finished) return; finished = true; flushActive(); if (activeMs) emit("active_time", {ms:activeMs}); };
  window.addEventListener("pagehide", finish, {once:true});
  window.addEventListener("beforeunload", finish, {once:true});
  const labelFor = el => {
    const raw = el.getAttribute("data-mc-label") || el.getAttribute("data-action") || el.getAttribute("aria-label") || el.getAttribute("title");
    if (raw) return raw.trim().slice(0,80);
    if (el.tagName === "A") { try { return new URL(el.href).pathname.split("/").filter(Boolean).slice(-2).join("/") || "home"; } catch {} }
    return el.tagName.toLowerCase();
  };
  document.addEventListener("click", event => {
    const el = event.target?.closest?.("a,button,[role=button],[data-action]");
    if (!el) return;
    const href = el.tagName === "A" ? el.getAttribute("href") : null;
    const target = href ? (() => { try { const u = new URL(href, location.href); return u.origin === location.origin ? u.pathname : u.origin; } catch { return "invalid"; } })() : null;
    const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random());
    const before = document.documentElement.innerHTML.length;
    emit("interaction", {id, element:el.tagName.toLowerCase(), label:labelFor(el), target, href_state:href === null ? "no-href" : (href === "#" ? "placeholder" : "set")});
    window.setTimeout(() => {
      const after = document.documentElement.innerHTML.length;
      const routeChanged = location.pathname !== path;
      emit("interaction_outcome", {id, outcome:routeChanged ? "route-changed" : after !== before ? "dom-size-changed" : "no-observed-dom-size-change"});
    }, 900);
  }, true);
  document.addEventListener("submit", () => emit("form_submit", {form:"submitted"}), true);
  window.addEventListener("error", e => emit("runtime_error", {kind:"window-error", source: e.filename ? "script" : "runtime"}));
  window.addEventListener("unhandledrejection", () => emit("runtime_error", {kind:"unhandled-rejection"}));
})();