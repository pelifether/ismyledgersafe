// Builds public/index.html: the anatomy figure, its live code and the page.
// Run with `npm run build` (Vercel runs it on deploy).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import { NANO_X } from "./nano-x.mjs";
import { STAX } from "./stax.mjs";

const FIGURES = [NANO_X, STAX];

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public");
const kitScript = () => readFileSync(join(HERE, "kit", "iso-kit.mjs"), "utf8").replace(/^export /gm, "");


const live = `
const FIGURES = ${JSON.stringify(FIGURES.map(({ id, title, P, LIFT, STAGGER, SPRING, LEADS, ride }) => ({ id, title, P, LIFT, STAGGER, SPRING, LEADS, ride })))};
const readout = document.querySelector("[data-readout]");
const title = document.querySelector('[data-corner="fig"]');
const still = matchMedia("(prefers-reduced-motion: reduce)");
let text = readout.textContent;
function say(next) { if (next !== text) { text = next; readout.textContent = next; } }
const linePath = (points) => "M" + points.map(([x, y]) => x.toFixed(1) + " " + y.toFixed(1)).join("L");

// One exploded figure: springs per assembly, staggered, and the leads that
// stretch as the implant lifts.
function mount(cfg) {
  const { P, LIFT, STAGGER, SPRING, LEADS } = cfg;
  const stage = document.querySelector('.iso-stage[data-device="' + cfg.id + '"]');
  const svg = stage.querySelector("svg");
  const parts = Object.fromEntries(STAGGER.map((name) => [name, { el: svg.querySelector('[data-part="' + name + '"]'), x: 0, v: 0, target: 0 }]));
  const leads = Object.keys(LEADS).map((kind) => ({ lead: LEADS[kind], el: svg.querySelector('[data-lead="' + kind + '"]') }));
  let pending = [], clock = 0, last = 0, frame = 0, visible = false, open = false, touring = !still.matches, tourAt = 1.6, idleTimer = 0;
  function schedule(next) {
    if (next === open && !pending.length) return;
    open = next;
    const value = next ? 1 : 0;
    const order = next ? STAGGER : [...STAGGER].reverse();
    pending = [];
    order.filter((name) => parts[name].target !== value || parts[name].x !== value).forEach((name, index) => pending.push({ name, value, at: clock + index * SPRING.stagger }));
    run();
  }
  function draw() {
    for (const name of STAGGER) {
      const part = parts[name];
      if (part.x === 0) part.el.removeAttribute("transform");
      else part.el.setAttribute("transform", translateAlong(P, (Array.isArray(LIFT[name]) ? LIFT[name] : [0, 0, LIFT[name]]).map((v) => v * part.x)));
    }
    const lift = LIFT[cfg.ride] * parts[cfg.ride].x;
    for (const { lead, el } of leads) el.setAttribute("d", linePath([...lead.floor, ...lead.tail.map(([x, y, z]) => [x, y, z + lift])].map((point) => iso(point, P))));
    stage.setAttribute("aria-pressed", open ? "true" : "false");
  }
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    clock += dt;
    if (touring && clock >= tourAt) { tourAt = clock + (open ? 2.6 : 3.4); schedule(!open); }
    pending = pending.filter((item) => { if (clock >= item.at) { parts[item.name].target = item.value; return false; } return true; });
    let moving = pending.length > 0;
    for (const name of STAGGER) {
      const part = parts[name];
      if (still.matches) { part.x = part.target; part.v = 0; continue; }
      const h = dt / SPRING.substeps;
      for (let i = 0; i < SPRING.substeps; i++) { part.v += ((part.target - part.x) * SPRING.stiffness - part.v * SPRING.damping) * h; part.x += part.v * h; }
      if (Math.abs(part.target - part.x) < 0.0005 && Math.abs(part.v) < 0.0005) { part.x = part.target; part.v = 0; } else moving = true;
    }
    draw();
    frame = visible && (moving || touring) ? requestAnimationFrame(tick) : 0;
  }
  function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
  function hold() {
    touring = false;
    clearTimeout(idleTimer);
    if (stage.dataset.mode === "idle") idleTimer = setTimeout(() => { touring = !still.matches; tourAt = clock + 1; run(); }, 6000);
  }
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
  stage.addEventListener("click", () => { hold(); schedule(!open); });
  stage.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter" || event.key === "e" || event.key === "E") { event.preventDefault(); hold(); schedule(!open); }
  });
  draw();
  return {
    stage,
    setMode(mode, finds) {
      stage.dataset.mode = mode;
      for (const node of svg.querySelectorAll("[data-find]")) node.toggleAttribute("data-hit", finds.includes(node.dataset.find));
      if (mode === "idle") { touring = !still.matches; tourAt = clock + 1; run(); return; }
      touring = false;
      clearTimeout(idleTimer);
      schedule(true);
    },
    focus(find) { for (const node of svg.querySelectorAll("[data-find]")) node.toggleAttribute("data-focus", node.dataset.find === find); },
  };
}

const figures = Object.fromEntries(FIGURES.map((cfg) => [cfg.id, mount(cfg)]));
const tabs = document.querySelectorAll("[data-show]");
function show(id) {
  if (!figures[id]) return;
  for (const [key, fig] of Object.entries(figures)) fig.stage.hidden = key !== id;
  for (const tab of tabs) tab.setAttribute("aria-selected", String(tab.dataset.show === id));
  title.textContent = FIGURES.find((cfg) => cfg.id === id).title;
}
for (const tab of tabs) tab.addEventListener("click", () => show(tab.dataset.show));

// The page drives the figures through this: idle (shows the spyware build),
// scan (opens and holds), clean, tampered (lights the parts that were found),
// unclear.
window.ledgerFigure = {
  show,
  setMode(mode, { finds = [], label = "" } = {}) {
    for (const fig of Object.values(figures)) fig.setMode(mode, finds);
    say(label);
  },
  focus(find) { for (const fig of Object.values(figures)) fig.focus(find); },
};
`;

const figure = k.plateHtml({
  fig: "Nano X",
  title: "",
  hint: "Tap to open",
  readout: "spyware build",
  body: FIGURES.map((cfg, index) => `<div class="iso-stage" data-device="${cfg.id}" tabindex="0" role="button" aria-pressed="false" data-mode="idle" aria-label="Exploded Ledger ${cfg.title}. Press to open or close."${index ? " hidden" : ""}>${cfg.figure()}</div>`).join(""),
});

const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const ICONS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="i-camera" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 3 22 20H2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></symbol>
<symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1" fill="currentColor"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
<symbol id="i-flask" viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7.5 15h9" stroke="currentColor" stroke-width="1.5"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
</svg>`;

const body = `${ICONS}
<main class="page">
  <header class="top"><h1>Is my Ledger safe?</h1></header>
  <div class="models" role="tablist" aria-label="Device">${FIGURES.map((cfg, index) => `<button type="button" role="tab" data-show="${cfg.id}" aria-selected="${index === 0}">${cfg.title}</button>`).join("")}</div>
  ${figure}
  <section class="intake" aria-label="Photos">
    <label class="drop" data-drop>
      <input type="file" accept="image/*" multiple hidden data-files>
      ${icon("camera")}
      <span class="drop-shots" aria-label="What to photograph"><span>screen or battery off</span><span>bare board</span><span>inside of case</span></span>
    </label>
    <ol class="thumbs" data-thumbs></ol>
    <button class="go" type="button" data-go disabled>Check</button>
  </section>
  <section class="result" data-result hidden aria-live="polite">
    <div class="verdict" data-verdict>
      <span class="verdict-mark" data-verdict-icon></span>
      <h2 data-verdict-title></h2>
      <span class="confidence" data-confidence></span>
    </div>
    <ul class="finds" data-finds></ul>
    <p class="advice" data-advice></p>
    <div class="shots" data-shots></div>
    <p class="need" data-need hidden></p>
    <form class="share" data-share>
      <button type="submit" class="share-go">${icon("flask")}<span>Share for research</span></button>
      <select name="bought_from" aria-label="Bought from">
        <option value="">Bought from…</option>
        <option value="ledger.com">ledger.com</option>
        <option value="amazon">Amazon</option>
        <option value="retail_store">Retail store</option>
        <option value="authorized_reseller">Authorized reseller</option>
        <option value="marketplace">Marketplace / other seller</option>
        <option value="second_hand">Second hand</option>
        <option value="gift_other">Gift / other</option>
      </select>
      <input name="country" maxlength="40" placeholder="Country" aria-label="Country of purchase" autocomplete="country-name">
      <input name="bought_on" inputmode="numeric" maxlength="7" pattern="\\d{4}-\\d{2}" placeholder="Bought YYYY-MM" aria-label="Month of purchase">
      <small>Photos + result, no personal data.</small>
    </form>
  </section>
  <footer class="foot">Visual check only. Firmware is not inspected.</footer>
</main>`;

const PAGE_CSS = readFileSync(join(HERE, "page.css"), "utf8");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Is my Ledger safe?</title>
<meta name="description" content="Post a photo of your opened hardware wallet. Get a quick visual check for implanted spyware hardware.">
<meta name="theme-color" content="#0b0b0b">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";</script>
<style>${k.ISO_CSS}${PAGE_CSS}</style>
</head>
<body class="iso">
${body}
<script>document.body.dataset.theme = document.documentElement.dataset.theme;</script>
<script type="module">${(kitScript() + live).replace(/<\/(script)/gi, "<\\/$1")}</script>
<script type="module" src="/app.js"></script>
</body>
</html>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), html);
console.log("wrote public/index.html", (html.length / 1024).toFixed(0) + " KB");
