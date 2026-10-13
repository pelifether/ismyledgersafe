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
    focus(finds) { for (const node of svg.querySelectorAll("[data-find]")) node.toggleAttribute("data-focus", finds.includes(node.dataset.find)); },
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
  focus(finds) { for (const fig of Object.values(figures)) fig.focus([].concat(finds || [])); },
};
`;

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

// Every word on the page, per language. Visitors from Brazil and Portugal get
// pt.html (see middleware.js); everyone else index.html.
const T = {
  en: {
    lang: "en",
    title: "Is my Ledger safe?",
    description: "Post a photo of your opened Ledger. Get a quick visual check for an implanted spy board.",
    hint: "Tap to open",
    idle: "spyware build",
    device: "Device",
    stage: (name) => `Exploded Ledger ${name}. Press to open or close.`,
    photos: "Photos",
    shoot: "What to photograph",
    shots: ["screen or battery off", "bare board", "inside of case"],
    check: "Check",
    share: "Share for research",
    from: "Bought from",
    fromAny: "Bought from…",
    sources: [["ledger.com", "ledger.com"], ["amazon", "Amazon"], ["retail_store", "Retail store"], ["authorized_reseller", "Authorized reseller"], ["marketplace", "Marketplace / other seller"], ["second_hand", "Second hand"], ["gift_other", "Gift / other"]],
    country: "Country",
    when: "When",
    whenAny: "When…",
    shareNote: "Photos + result. No personal data.",
    foot: "Visual check only; firmware is not inspected. Photos go to Anthropic's API for the check and are not kept here unless you share them.",
    other: ["Português", "/?lang=pt", "pt"],
  },
  pt: {
    lang: "pt-BR",
    title: "Meu Ledger é seguro?",
    description: "Envie uma foto do seu Ledger aberto. Receba uma verificação visual rápida de placa espiã implantada.",
    hint: "Toque para abrir",
    idle: "versão com espião",
    device: "Aparelho",
    stage: (name) => `Ledger ${name} desmontado. Toque para abrir ou fechar.`,
    photos: "Fotos",
    shoot: "O que fotografar",
    shots: ["sem tela ou bateria", "placa exposta", "interior da carcaça"],
    check: "Verificar",
    share: "Compartilhar para pesquisa",
    from: "Comprado em",
    fromAny: "Comprado em…",
    sources: [["ledger.com", "ledger.com"], ["amazon", "Amazon"], ["retail_store", "Loja física"], ["authorized_reseller", "Revendedor autorizado"], ["marketplace", "Marketplace / outro vendedor"], ["second_hand", "Usado"], ["gift_other", "Presente / outro"]],
    country: "País",
    when: "Quando",
    whenAny: "Quando…",
    shareNote: "Fotos + resultado. Sem dados pessoais.",
    foot: "Verificação apenas visual; o firmware não é inspecionado. As fotos vão para a API da Anthropic para a verificação e não ficam guardadas aqui, a menos que você as compartilhe.",
    other: ["English", "/?lang=en", "en"],
  },
};

const chevron = `<svg class="ic chev" aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function page(t) {
  const figure = k.plateHtml({
    fig: "Nano X",
    title: "",
    hint: t.hint,
    readout: t.idle,
    body: FIGURES.map((cfg, index) => `<div class="iso-stage" data-device="${cfg.id}" tabindex="0" role="button" aria-pressed="false" data-mode="idle" aria-label="${t.stage(cfg.title)}"${index ? " hidden" : ""}>${cfg.figure()}</div>`).join(""),
  });
  const body = `${ICONS}
<main class="page">
  <header class="top"><h1>${t.title}</h1></header>
  <div class="models" role="tablist" aria-label="${t.device}">${FIGURES.map((cfg, index) => `<button type="button" role="tab" data-show="${cfg.id}" aria-selected="${index === 0}">${cfg.title}</button>`).join("")}</div>
  ${figure}
  <section class="intake" aria-label="${t.photos}">
    <label class="drop" data-drop>
      <input type="file" accept="image/*" multiple hidden data-files>
      ${icon("camera")}
      <span class="drop-shots" aria-label="${t.shoot}">${t.shots.map((shot) => `<span>${shot}</span>`).join("")}</span>
    </label>
    <ol class="thumbs" data-thumbs></ol>
    <button class="go" type="button" data-go disabled>${t.check}</button>
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
    <div class="need" data-need hidden></div>
    <form class="share" data-share>
      <div class="share-fields">
        <label class="field"><span>${t.from}</span><span class="control"><select name="bought_from"><option value="">${t.fromAny}</option>${t.sources.map(([value, name]) => `<option value="${value}">${name}</option>`).join("")}</select>${chevron}</span></label>
        <label class="field"><span>${t.country}</span><span class="control"><select name="country" data-countries><option value="">${t.country}…</option></select>${chevron}</span></label>
        <label class="field"><span>${t.when}</span><span class="control"><select name="bought_on" data-months><option value="">${t.whenAny}</option></select>${chevron}</span></label>
      </div>
      <div class="share-row">
        <button type="submit" class="share-go">${icon("flask")}<span>${t.share}</span></button>
        <small>${t.shareNote}</small>
      </div>
    </form>
  </section>
  <footer class="foot"><p>${t.foot}</p><a href="${t.other[1]}" hreflang="${t.other[2]}" data-lang="${t.other[2]}">${t.other[0]}</a></footer>
</main>`;
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.title}</title>
<meta name="description" content="${t.description}">
<meta name="theme-color" content="#0b0b0b">
<meta name="referrer" content="no-referrer">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" hreflang="en" href="/?lang=en">
<link rel="alternate" hreflang="pt-BR" href="/?lang=pt">
<style>${CSS}</style>
</head>
<body class="iso">
${body}
<script type="module" src="/figure.js"></script>
<script type="module" src="/app.js"></script>
</body>
</html>
`;
}

// Light theme by media query instead of a script, so the page runs no inline
// script and the Content-Security-Policy can forbid them.
const light = /\.iso\[data-theme="light"\]\{([^}]*)\}/.exec(k.ISO_CSS)[1];
const CSS = k.ISO_CSS + `@media (prefers-color-scheme: light){.iso{${light}}}` + readFileSync(join(HERE, "page.css"), "utf8");

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "figure.js"), kitScript() + live);
writeFileSync(join(OUT, "index.html"), page(T.en));
writeFileSync(join(OUT, "pt.html"), page(T.pt));
console.log("wrote public/index.html, public/pt.html, public/figure.js");
