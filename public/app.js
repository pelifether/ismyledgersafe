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
  added_wires: "Added wires",
  antenna_cable: "Antenna cable",
  antenna_in_case: "Antenna in case",
  stacked_board: "Extra board",
  cellular_module: "LTE module",
};
// Which parts of the figure each sign lights up.
const PARTS = {
  added_wires: ["power_tap_wires"],
  antenna_cable: ["coax_cable", "antenna_socket"],
  antenna_in_case: ["antenna_in_case"],
  stacked_board: ["extra_board", "extra_mcu", "esim"],
  cellular_module: ["cellular_module"],
};
const RETAKE = {
  open_device: "Open the device and photograph the inside.",
  remove_screen: "Take the screen off the board: flip up the small latch on its connector, lift the screen away, and photograph the bare board.",
  remove_battery: "Take the battery off the board and photograph the bare board under it.",
  show_board: "Photograph the main board, both sides.",
  show_case_inside: "Also photograph the inside of the case.",
  sharper_photo: "Take sharper, closer photos in good light.",
};
const DEVICE = { nano_s: "Nano S", nano_s_plus: "Nano S Plus", nano_x: "Nano X", stax: "Stax", flex: "Flex", nano_gen5: "Nano Gen5", other_wallet: "Wallet", not_a_wallet: "", unknown: "" };
const VERDICT = {
  implant_found: { title: "Implant found", icon: "alert", mode: "tampered", readout: "implant found", advice: "Don't use this device. Treat its recovery phrase as exposed: move your funds to a new phrase made on a device bought from ledger.com, and report it to Ledger and the seller." },
  no_implant_seen: { title: "No implant found", icon: "check", mode: "clean", readout: "no implant", advice: "" },
  incomplete: { title: "One more photo", icon: "camera", mode: "unclear", readout: "needs a photo", advice: "" },
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
  const v = VERDICT[r.verdict] || VERDICT.incomplete;
  const codes = [...new Set(r.findings.map((f) => f.code))];
  const label = [DEVICE[r.device], v.readout].filter(Boolean).join(" · ");
  const drawn = { nano_x: "nano_x", stax: "stax", flex: "stax", nano_gen5: "stax" }[r.device];
  if (drawn) figure()?.show(drawn);
  figure()?.setMode(v.mode, { finds: codes.flatMap((code) => PARTS[code] || []), label });

  result.hidden = false;
  $("[data-verdict]").dataset.v = r.verdict;
  $("[data-verdict-icon]").innerHTML = icon(v.icon);
  $("[data-verdict-title]").textContent = v.title;
  $("[data-confidence]").textContent = r.verdict === "incomplete" ? "" : r.confidence + " confidence";
  $("[data-finds]").innerHTML = codes
    .map((code) => {
      const notes = r.findings.filter((f) => f.code === code).map((f) => f.detail).filter(Boolean).join("; ");
      return `<li><button type="button" data-code="${code}" aria-pressed="false" title="${escape(notes)}">${escape(LABEL[code] || code)}</button></li>`;
    })
    .join("");
  const sku = r.antenna_sku ? ` Antenna label: ${r.antenna_sku}.` : "";
  $("[data-advice]").innerHTML = `${escape(r.summary + sku)}${v.advice ? `<b>${escape(v.advice)}</b>` : ""}`;

  // Photos only where there is something to point at.
  $("[data-shots]").innerHTML = sent
    .map((data, i) => {
      const boxes = r.findings
        .filter((f) => f.photo === i + 1 && f.box.length === 4)
        .map((f) => {
          const [x0, y0, x1, y1] = f.box.map((n) => n / 10);
          return `<div class="box" data-code="${f.code}" style="left:${x0}%;top:${y0}%;width:${x1 - x0}%;height:${y1 - y0}%"><span>${escape(LABEL[f.code] || f.code)}</span></div>`;
        })
        .join("");
      return boxes ? `<figure class="shot"><img src="${data}" alt="Photo ${i + 1}">${boxes}</figure>` : "";
    })
    .join("");

  const need = $("[data-need]");
  const steps = r.retake.map((step) => RETAKE[step]).filter(Boolean);
  need.hidden = !steps.length;
  need.innerHTML = steps.length ? `${icon("camera")}<ol>${steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol>` : "";
  need.toggleAttribute("data-main", r.verdict === "incomplete");

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
