const MAX = 6;
const LONG_EDGE = 2000;
const BUDGET = 3_800_000; // Vercel caps a request body at 4.5 MB

const $ = (selector) => document.querySelector(selector);
const drop = $("[data-drop]");
const input = $("[data-files]");
const thumbs = $("[data-thumbs]");
const go = $("[data-go]");
const result = $("[data-result]");
const share = $("[data-share]");
const figure = () => window.ledgerFigure;

const LANG = document.documentElement.lang.startsWith("pt") ? "pt" : "en";
const STRINGS = {
  en: {
    label: { added_wires: "Added wires", antenna_cable: "Antenna cable", antenna_in_case: "Antenna in case", stacked_board: "Extra board", cellular_module: "LTE module" },
    retake: {
      open_device: "Open the device and photograph the inside.",
      remove_screen: "Take the screen off the board: flip up the small latch on its connector, lift the screen away, and photograph the bare board.",
      remove_battery: "Take the battery off the board and photograph the bare board under it.",
      show_board: "Photograph the main board, both sides.",
      show_case_inside: "Also photograph the inside of the case.",
      sharper_photo: "Take sharper, closer photos in good light.",
    },
    verdict: {
      implant_found: { title: "Implant found", readout: "implant found", advice: "Don't use this device. Treat its recovery phrase as exposed: move your funds to a new phrase made on a device bought from ledger.com, and report it to Ledger and the seller." },
      no_implant_seen: { title: "No implant found", readout: "no implant", advice: "" },
      incomplete: { title: "One more photo", readout: "needs a photo", advice: "" },
    },
    confidence: { low: "low confidence", medium: "medium confidence", high: "high confidence" },
    antenna: "Antenna label:",
    photo: (n) => `Photo ${n}`,
    remove: (n) => `Remove photo ${n}`,
    checking: "Checking…",
    check: "Check",
    scanning: "scanning",
    idle: "spyware build",
    share: "Share for research",
    sharing: "Sharing…",
    shared: "Shared. Thank you.",
    earlier: "Earlier",
    errors: {
      burst: "Too many checks. Try again in a few minutes.",
      visitor_limit: "You have reached today's limit of checks. Try again tomorrow.",
      site_limit: "The checker has reached its daily limit. Try again tomorrow.",
      bad_photos: "Send 1 to 6 photos.",
      not_ready: "The checker is not available right now.",
      refused: "These photos could not be checked.",
      expired: "This result has expired. Check again to share.",
      mismatch: "Photos do not match the check.",
      failed: "The check failed. Try again.",
      share_failed: "Could not share. Try again.",
    },
  },
  pt: {
    label: { added_wires: "Fios adicionados", antenna_cable: "Cabo de antena", antenna_in_case: "Antena na carcaça", stacked_board: "Placa extra", cellular_module: "Módulo LTE" },
    retake: {
      open_device: "Abra o aparelho e fotografe o interior.",
      remove_screen: "Tire a tela da placa: levante a pequena trava do conector, afaste a tela e fotografe a placa exposta.",
      remove_battery: "Tire a bateria da placa e fotografe a placa exposta embaixo dela.",
      show_board: "Fotografe a placa principal, dos dois lados.",
      show_case_inside: "Fotografe também o interior da carcaça.",
      sharper_photo: "Tire fotos mais nítidas e de perto, com boa luz.",
    },
    verdict: {
      implant_found: { title: "Implante encontrado", readout: "implante encontrado", advice: "Não use este aparelho. Considere a frase de recuperação exposta: transfira seus fundos para uma nova frase criada em um aparelho comprado em ledger.com e denuncie à Ledger e ao vendedor." },
      no_implant_seen: { title: "Nenhum implante encontrado", readout: "sem implante", advice: "" },
      incomplete: { title: "Falta uma foto", readout: "falta uma foto", advice: "" },
    },
    confidence: { low: "confiança baixa", medium: "confiança média", high: "confiança alta" },
    antenna: "Etiqueta da antena:",
    photo: (n) => `Foto ${n}`,
    remove: (n) => `Remover foto ${n}`,
    checking: "Verificando…",
    check: "Verificar",
    scanning: "analisando",
    idle: "versão com espião",
    share: "Compartilhar para pesquisa",
    sharing: "Compartilhando…",
    shared: "Compartilhado. Obrigado!",
    earlier: "Antes disso",
    errors: {
      burst: "Muitas verificações. Tente de novo em alguns minutos.",
      visitor_limit: "Você atingiu o limite de verificações de hoje. Tente amanhã.",
      site_limit: "O verificador atingiu o limite diário. Tente amanhã.",
      bad_photos: "Envie de 1 a 6 fotos.",
      not_ready: "O verificador não está disponível agora.",
      refused: "Não foi possível verificar estas fotos.",
      expired: "Este resultado expirou. Verifique de novo para compartilhar.",
      mismatch: "As fotos não correspondem à verificação.",
      failed: "A verificação falhou. Tente de novo.",
      share_failed: "Não foi possível compartilhar. Tente de novo.",
    },
  },
};
const t = STRINGS[LANG];

// Which parts of the figure each sign lights up.
const PARTS = {
  added_wires: ["power_tap_wires"],
  antenna_cable: ["coax_cable", "antenna_socket"],
  antenna_in_case: ["antenna_in_case"],
  stacked_board: ["extra_board", "extra_mcu", "esim"],
  cellular_module: ["cellular_module"],
};
const ICON = { implant_found: "alert", no_implant_seen: "check", incomplete: "camera" };
const MODE = { implant_found: "tampered", no_implant_seen: "clean", incomplete: "unclear" };
const DEVICE = { nano_s: "Nano S", nano_s_plus: "Nano S Plus", nano_x: "Nano X", stax: "Stax", flex: "Flex", nano_gen5: "Nano Gen5" };

let photos = []; // { file, data } data = shrunk JPEG data URL
let last = null; // { receipt, result, sent }

const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// The language switch remembers the choice; middleware.js reads the cookie.
for (const link of document.querySelectorAll("[data-lang]")) {
  link.addEventListener("click", () => {
    document.cookie = `lang=${link.dataset.lang}; path=/; max-age=31536000; samesite=lax; secure`;
  });
}

// Country and month lists for the research form, in the page's language.
const REGIONS =
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW".split(" ");
try {
  const names = new Intl.DisplayNames([LANG === "pt" ? "pt-BR" : "en"], { type: "region" });
  const options = REGIONS.map((code) => [code, names.of(code) || code]).sort((a, b) => a[1].localeCompare(b[1], LANG));
  $("[data-countries]").insertAdjacentHTML("beforeend", options.map(([code, name]) => `<option value="${code}">${escape(name)}</option>`).join(""));
} catch {
  /* very old browser: the field stays empty, which is allowed */
}
{
  const month = new Intl.DateTimeFormat(LANG === "pt" ? "pt-BR" : "en", { month: "long", year: "numeric" });
  const now = new Date();
  const options = [];
  for (let back = 0; back < 36; back++) {
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const name = month.format(date);
    options.push(`<option value="${value}">${escape(name.charAt(0).toUpperCase() + name.slice(1))}</option>`);
  }
  options.push(`<option value="earlier">${t.earlier}</option>`);
  $("[data-months]").insertAdjacentHTML("beforeend", options.join(""));
}

async function shrink(file, edge, quality) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  // Re-encoding through a canvas drops EXIF, GPS included.
  return canvas.toDataURL("image/jpeg", quality);
}

async function add(files) {
  const list = [...files].filter((file) => file.type.startsWith("image/")).slice(0, MAX - photos.length);
  for (const file of list) {
    try {
      const data = await shrink(file, LONG_EDGE, 0.86);
      photos.push({ file, data });
    } catch {
      /* unreadable image (e.g. HEIC on a browser that can't decode it) */
    }
  }
  await fit();
  render();
}

// Keep the whole request under the body limit.
async function fit() {
  const size = () => photos.reduce((sum, p) => sum + p.data.length, 0);
  for (const [edge, quality] of [[1800, 0.82], [1600, 0.78], [1400, 0.74]]) {
    if (size() <= BUDGET) return;
    for (const photo of photos) photo.data = await shrink(photo.file, edge, quality);
  }
}

function render() {
  thumbs.innerHTML = photos
    .map((p, i) => `<li><img src="${p.data}" alt="${t.photo(i + 1)}"><button type="button" data-remove="${i}" aria-label="${t.remove(i + 1)}">${icon("x")}</button></li>`)
    .join("");
  go.disabled = photos.length === 0;
  drop.hidden = photos.length >= MAX;
}

thumbs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  photos.splice(Number(button.dataset.remove), 1);
  render();
});
input.addEventListener("change", () => {
  add(input.files);
  input.value = "";
});
for (const name of ["dragenter", "dragover"]) drop.addEventListener(name, (event) => { event.preventDefault(); drop.dataset.over = ""; });
for (const name of ["dragleave", "drop"]) drop.addEventListener(name, () => delete drop.dataset.over);
drop.addEventListener("drop", (event) => { event.preventDefault(); add(event.dataTransfer.files); });
document.addEventListener("paste", (event) => { if (event.clipboardData?.files?.length) add(event.clipboardData.files); });

async function post(path, payload, fallback) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), credentials: "omit", cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(t.errors[body.code] || t.errors[fallback]);
  return body;
}

go.addEventListener("click", async () => {
  if (!photos.length || go.dataset.busy !== undefined) return;
  go.dataset.busy = "";
  go.textContent = t.checking;
  result.hidden = true;
  figure()?.setMode("scan", { label: t.scanning });
  document.querySelector(".iso-figure").scrollIntoView({ behavior: "smooth", block: "center" });
  try {
    const sent = photos.map((p) => p.data);
    const body = await post("/api/check", { photos: sent, lang: LANG }, "failed");
    last = { receipt: body.receipt, result: body.result, sent };
    show(body.result, sent);
  } catch (error) {
    figure()?.setMode("idle", { label: t.idle });
    showError(error.message);
  } finally {
    delete go.dataset.busy;
    go.textContent = t.check;
  }
});

function showError(message) {
  result.hidden = false;
  $("[data-verdict]").dataset.v = "incomplete";
  $("[data-verdict-icon]").innerHTML = icon("help");
  $("[data-verdict-title]").innerHTML = `<span class="error">${escape(message)}</span>`;
  $("[data-confidence]").textContent = "";
  $("[data-finds]").innerHTML = "";
  $("[data-advice]").textContent = "";
  $("[data-shots]").innerHTML = "";
  $("[data-need]").hidden = true;
  share.hidden = true;
}

function show(r, sent) {
  const v = t.verdict[r.verdict] || t.verdict.incomplete;
  const codes = [...new Set(r.findings.map((f) => f.code))].filter((code) => t.label[code]);
  const label = [DEVICE[r.device], v.readout].filter(Boolean).join(" · ");
  const drawn = { nano_x: "nano_x", stax: "stax", flex: "stax", nano_gen5: "stax" }[r.device];
  if (drawn) figure()?.show(drawn);
  figure()?.setMode(MODE[r.verdict] || "unclear", { finds: codes.flatMap((code) => PARTS[code] || []), label });

  result.hidden = false;
  $("[data-verdict]").dataset.v = r.verdict;
  $("[data-verdict-icon]").innerHTML = icon(ICON[r.verdict] || "camera");
  $("[data-verdict-title]").textContent = v.title;
  $("[data-confidence]").textContent = r.verdict === "incomplete" ? "" : t.confidence[r.confidence] || "";
  $("[data-finds]").innerHTML = codes
    .map((code) => {
      const notes = r.findings.filter((f) => f.code === code).map((f) => f.detail).filter(Boolean).join("; ");
      return `<li><button type="button" data-code="${code}" aria-pressed="false" title="${escape(notes)}">${escape(t.label[code])}</button></li>`;
    })
    .join("");
  const sku = r.antenna_sku ? ` ${t.antenna} ${r.antenna_sku}.` : "";
  $("[data-advice]").innerHTML = `${escape(r.summary + sku)}${v.advice ? `<b>${escape(v.advice)}</b>` : ""}`;

  // Photos only where there is something to point at.
  $("[data-shots]").innerHTML = sent
    .map((data, i) => {
      const boxes = r.findings
        .filter((f) => f.photo === i + 1 && f.box.length === 4 && t.label[f.code])
        .map((f) => {
          const [x0, y0, x1, y1] = f.box.map((n) => Math.max(0, Math.min(100, Number(n) / 10)));
          return `<div class="box" data-code="${f.code}" style="left:${x0}%;top:${y0}%;width:${x1 - x0}%;height:${y1 - y0}%"><span>${escape(t.label[f.code])}</span></div>`;
        })
        .join("");
      return boxes ? `<figure class="shot"><img src="${data}" alt="${t.photo(i + 1)}">${boxes}</figure>` : "";
    })
    .join("");

  const need = $("[data-need]");
  const steps = r.retake.map((step) => t.retake[step]).filter(Boolean);
  need.hidden = !steps.length;
  need.innerHTML = steps.length ? `${icon("camera")}<ol>${steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol>` : "";
  need.toggleAttribute("data-main", r.verdict === "incomplete");

  share.hidden = false;
  share.reset();
  delete share.dataset.done;
  share.querySelector(".share-go span").textContent = t.share;
  share.querySelector(".share-go").disabled = false;
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

$("[data-finds]").addEventListener("click", (event) => {
  const button = event.target.closest("[data-code]");
  if (!button) return;
  const on = button.getAttribute("aria-pressed") !== "true";
  for (const other of document.querySelectorAll("[data-finds] [data-code]")) other.setAttribute("aria-pressed", String(on && other === button));
  for (const box of document.querySelectorAll(".box")) box.toggleAttribute("data-focus", on && box.dataset.code === button.dataset.code);
  figure()?.focus(on ? PARTS[button.dataset.code] || [] : []);
});

share.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!last || share.dataset.done !== undefined) return;
  const button = share.querySelector(".share-go");
  const text = button.querySelector("span");
  button.disabled = true;
  text.textContent = t.sharing;
  const form = new FormData(share);
  try {
    await post("/api/share", { receipt: last.receipt, photos: last.sent, bought_from: form.get("bought_from"), country: form.get("country"), bought_on: form.get("bought_on") }, "share_failed");
    share.dataset.done = "";
    text.textContent = t.shared;
  } catch (error) {
    button.disabled = false;
    text.textContent = error.message;
  }
});
