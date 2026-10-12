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

const LABEL = {
  cellular_module: "LTE modem",
  extra_mcu: "Extra MCU",
  esim: "eSIM",
  extra_board: "Extra board",
  antenna_socket: "Antenna socket",
  coax_cable: "Coax cable",
  antenna_in_case: "Antenna in case",
  power_tap_wires: "Tap wires",
  rework_or_glue: "Rework / glue",
  non_genuine_board: "Non-original board",
  non_genuine_battery: "Non-original battery",
  unknown_component: "Unknown part",
};
const VIEW = {
  open_device: "the opened device",
  board_top: "board, top",
  board_bottom: "board, bottom",
  case_inside: "inside of case",
  battery: "battery",
  screen_back: "back of screen",
  chip_closeup: "chip markings, close",
  sharper_photo: "sharper photos",
};
const DEVICE = { nano_s: "Nano S", nano_s_plus: "Nano S Plus", nano_x: "Nano X", stax: "Stax", flex: "Flex", nano_gen5: "Nano Gen5", other_wallet: "Wallet", not_a_wallet: "Not a wallet", unknown: "" };
const VERDICT = {
  tampered: { title: "Tampered", icon: "alert", mode: "tampered", advice: "Do not use it. Treat its seed as exposed: move funds to a new seed made on a device bought from ledger.com. Report it to Ledger and the seller." },
  suspicious: { title: "Suspicious", icon: "alert", mode: "tampered", advice: "Do not use it until an expert has looked at it." },
  no_implant_seen: { title: "No implant seen", icon: "check", mode: "clean", advice: "No added hardware visible. Also run the Genuine Check in Ledger Live." },
  cannot_tell: { title: "Can't tell", icon: "help", mode: "unclear", advice: "" },
};

let photos = []; // { url, data } data = shrunk data URL
let last = null; // { receipt, result }

const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function shrink(file, edge, quality) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
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
    .map((p, i) => `<li><img src="${p.data}" alt="Photo ${i + 1}"><button type="button" data-remove="${i}" aria-label="Remove photo ${i + 1}">${icon("x")}</button></li>`)
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

go.addEventListener("click", async () => {
  if (!photos.length || go.dataset.busy !== undefined) return;
  go.dataset.busy = "";
  go.textContent = "Checking…";
  result.hidden = true;
  figure()?.setMode("scan", { label: "scanning" });
  document.querySelector(".iso-figure").scrollIntoView({ behavior: "smooth", block: "center" });
  try {
    const response = await fetch("/api/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ photos: photos.map((p) => p.data) }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "The check failed. Try again.");
    last = { receipt: body.receipt, result: body.result, sent: photos.map((p) => p.data) };
    show(body.result, last.sent);
  } catch (error) {
    figure()?.setMode("idle", { label: "spyware build" });
    showError(error.message);
  } finally {
    delete go.dataset.busy;
    go.textContent = "Check";
  }
});

function showError(message) {
  result.hidden = false;
  $("[data-verdict]").dataset.v = "cannot_tell";
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
  const v = VERDICT[r.verdict] || VERDICT.cannot_tell;
  const codes = [...new Set(r.findings.map((f) => f.code))];
  const device = DEVICE[r.device] || "";
  const label = [device, r.verdict === "no_implant_seen" ? "no implant seen" : r.verdict === "cannot_tell" ? "can't tell" : `${codes.length} sign${codes.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
  figure()?.setMode(v.mode, { finds: codes, label });

  result.hidden = false;
  $("[data-verdict]").dataset.v = r.verdict;
  $("[data-verdict-icon]").innerHTML = icon(v.icon);
  $("[data-verdict-title]").textContent = v.title;
  $("[data-confidence]").textContent = r.confidence + " confidence";
  $("[data-finds]").innerHTML = codes
    .map((code) => {
      const notes = r.findings.filter((f) => f.code === code).map((f) => f.detail).filter(Boolean).join("; ");
      return `<li><button type="button" data-code="${code}" aria-pressed="false" title="${escape(notes)}">${escape(LABEL[code] || code)}</button></li>`;
    })
    .join("");
  const sku = r.antenna_sku ? ` Antenna: ${r.antenna_sku}.` : "";
  $("[data-advice]").innerHTML = `${escape(r.summary + sku)}${v.advice ? `<b>${escape(v.advice)}</b>` : ""}`;

  const boxed = new Set(r.findings.filter((f) => f.box.length).map((f) => f.photo));
  $("[data-shots]").innerHTML = sent
    .map((data, i) => {
      if (codes.length && !boxed.has(i + 1)) return "";
      const boxes = r.findings
        .filter((f) => f.photo === i + 1 && f.box.length === 4)
        .map((f) => {
          const [x0, y0, x1, y1] = f.box.map((n) => n / 10);
          return `<div class="box" data-code="${f.code}" style="left:${x0}%;top:${y0}%;width:${x1 - x0}%;height:${y1 - y0}%"><span>${escape(LABEL[f.code] || f.code)}</span></div>`;
        })
        .join("");
      return `<figure class="shot"><img src="${data}" alt="Photo ${i + 1}">${boxes}</figure>`;
    })
    .join("");

  const need = $("[data-need]");
  need.hidden = !r.missing_views.length;
  need.innerHTML = r.missing_views.length ? `${icon("camera")} ${r.missing_views.map((v) => `<b>${escape(VIEW[v] || v)}</b>`).join(" · ")}` : "";

  share.hidden = false;
  delete share.dataset.done;
  share.querySelector(".share-go span").textContent = "Share for research";
  share.querySelector(".share-go").disabled = false;
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

$("[data-finds]").addEventListener("click", (event) => {
  const button = event.target.closest("[data-code]");
  if (!button) return;
  const on = button.getAttribute("aria-pressed") !== "true";
  for (const other of document.querySelectorAll("[data-finds] [data-code]")) other.setAttribute("aria-pressed", String(on && other === button));
  for (const box of document.querySelectorAll(".box")) box.toggleAttribute("data-focus", on && box.dataset.code === button.dataset.code);
  figure()?.focus(on ? button.dataset.code : null);
});

share.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!last || share.dataset.done !== undefined) return;
  const button = share.querySelector(".share-go");
  const text = button.querySelector("span");
  button.disabled = true;
  text.textContent = "Sharing…";
  const form = new FormData(share);
  try {
    const response = await fetch("/api/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ receipt: last.receipt, photos: last.sent, bought_from: form.get("bought_from"), country: form.get("country"), bought_on: form.get("bought_on") }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Could not share.");
    share.dataset.done = "";
    text.textContent = "Shared. Thank you.";
  } catch (error) {
    button.disabled = false;
    text.textContent = error.message;
  }
});
