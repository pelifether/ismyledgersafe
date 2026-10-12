// Exploded Ledger Nano X on a teardown mat, drawn with the anatomy kit.
// World units: 1 mm = 4 units. x runs along the device, y across it, z up.
// The genuine stack is: lower shell, battery, main board, OLED, top cover.
// The spyware build adds, in red: an antenna glued in the lower shell, a coax
// lead taped over the battery, power-tap wires from the battery, and an implant
// board (LTE module, MCU, eSIM, U.FL socket) stacked on the main board.
import * as k from "./kit/iso-kit.mjs";
import { centreOf, plan, tools } from "./tools.mjs";

export const WIDTH = 640;
export const HEIGHT = 470;

const MM = 4;
const LEN = 72 * MM;
const WID = 18.6 * MM;

export const SHELL = { x: -LEN / 2, y: -WID / 2, w: LEN, d: WID, r: 10 };
export const RIM = 26;
const WALL = 3;
export const INNER = k.insetPlan(SHELL, WALL);
const FLOOR = 3;
const COVER_H = 20;

const MAT = { x: -205, y: -78, w: 410, d: 168, r: 8 };
const MAT_H = 4;

const BATTERY = { x: -112, y: -27, w: 176, d: 52, r: 3 };
const BATTERY_H = 10;
const BATTERY_TOP = FLOOR + BATTERY_H;
const TABS = { x: -128, y: -27, w: 14, d: 52, r: 1.5 };

const ANTENNA = { x: 74, y: -30, w: 58, d: 58, r: 2 };

const PCB = { x: -132, y: -31, w: 254, d: 62, r: 6 };
const PCB_Z = 15;
const PCB_TOP = PCB_Z + 2.4;

const IMPLANT = { x: -74, y: -27, w: 118, d: 48, r: 3 };
export const IMPLANT_Z = PCB_TOP + 3.2;
export const IMPLANT_TOP = IMPLANT_Z + 2;

const OLED = { x: -66, y: -24, w: 132, d: 48, r: 2 };
const OLED_Z = RIM - 3.4;
const OLED_TOP = RIM - 0.4;

// U.FL socket on the implant, and the coax that runs from the antenna in the
// lower shell, over the battery, up the far wall to it.
export const SOCKET = [26, -21];
export const LEAD_Y = -33.2;
export const COAX_FLOOR = [
  [92, 0, FLOOR + 0.8],
  [74, 0, BATTERY_TOP + 0.9],
  [60, -14, BATTERY_TOP + 0.9],
  [44, -24, BATTERY_TOP + 0.9],
  [34, LEAD_Y, BATTERY_TOP + 2],
];
export const TAP_FLOOR = [
  [-121, -18, FLOOR + 6],
  [-108, -24, BATTERY_TOP + 0.9],
  [-92, LEAD_Y, BATTERY_TOP + 2],
];
export const TAP_PAD = [-66, -23];

// Assemblies that lift out, in the order they leave (top first).
export const LIFT = { cover: 196, oled: 138, implant: 92, pcb: 48 };
export const STAGGER = ["cover", "oled", "implant", "pcb"];
export const SPRING = { stiffness: 64, damping: 14.2, substeps: 4, stagger: 0.07 };

export const P = k.fitProjection(
  [
    ...k.boxCorners(MAT, -MAT_H, 0),
    ...k.boxCorners(SHELL, RIM + LIFT.cover, RIM + LIFT.cover + COVER_H + 3),
  ],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 62, elevation: 32 },
);

const { at, S, L, D, byDepth, chip, passives, cavity, sweep, meander, leadSvg, mat: matOf } = tools(P);

const mat = () => matOf(MAT, MAT_H, MM, [[174, -40], [174, -6], [-174, 26]], [[170, -43], [178, -37]]);

function shell() {
  const out = [`<path class="iso-halo" d="${k.haloOf(SHELL, 0, RIM, P)}"/>`];
  out.push(S(k.slabOf(SHELL, 0, RIM, P, 8, 1), { tone: "mid", crease: "lo", className: "lg-case" }));
  // USB-C opening in the right end wall, and the lanyard eye at the left.
  out.push(L(k.sideRing([SHELL.x + SHELL.w, 0, 13], 5.2, "x", P), { tone: "lo" }));
  // Seen through the opening: wall faces, then the floor.
  out.push(cavity(INNER, RIM, FLOOR));
  return out.join("");
}

function antenna() {
  const z = FLOOR;
  const out = [meander(ANTENNA, z)];
  out.push(k.faceTextSvg(k.topMatrix([ANTENNA.x + 5, ANTENNA.y + ANTENNA.d - 4], z + 0.6, P, "x"), "AC-A2205-NANO-X", { size: 3.4, tone: "lo" }));
  // Ground pad the coax is soldered to.
  out.push(S(k.slabOf(plan(88, -4, 8, 8, 1), z + 0.6, 0.6, P, 2), { tone: "hi", crease: "none", className: "lg-bad" }));
  return `<g class="lg-bad" data-find="antenna_in_case">${out.join("")}</g>`;
}

function battery() {
  const out = [];
  out.push(S(k.slabOf(BATTERY, FLOOR, BATTERY_H, P, 3, 0.8), { tone: "mid", crease: "lo", className: "lg-cell" }));
  // Sealed pouch edge and the printed label as rule lines.
  out.push(L(k.planOutline(k.insetPlan(BATTERY, 4), BATTERY_TOP, P, 3), { tone: "faint" }));
  const rules = [];
  for (const [index, y] of [-12, -6, 0, 6].entries()) {
    rules.push(k.lineOnTop([-40, y], [index % 2 ? 10 : 30, y], BATTERY_TOP, P));
  }
  out.push(L(rules.join(""), { tone: "lo", free: true }));
  // Protection board and nickel tabs at the left end.
  out.push(S(k.slabOf(TABS, FLOOR + 2, 7, P, 2, 0.4), { tone: "mid", crease: "lo" }));
  out.push(D([at([-121, -18, FLOOR + 9]), at([-121, 0, FLOOR + 9]), at([-121, 18, FLOOR + 9])], { size: 0.9, tone: "mid" }));
  return out.join("");
}

function tapWires() {
  // Red enamelled wires soldered onto the battery protection board.
  const out = [];
  out.push(D([at([-121, -18, FLOOR + 9])], { size: 1.4, tone: "hi" }));
  return `<g class="lg-bad" data-find="power_tap_wires">${out.join("")}</g>`;
}

function pcb() {
  const z = PCB_Z;
  const top = PCB_TOP;
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(PCB, 4), z, 0.1, P)}" style="filter:blur(5px)"/>`];
  out.push(S(k.slabOf(PCB, z, top - z, P, 6, 0.4), { tone: "mid", crease: "lo", className: "lg-board" }));
  out.push(L(k.planOutline(k.insetPlan(PCB, 2.4), top, P, 6), { tone: "faint" }));
  // Mounting holes and test pads.
  for (const [x, y] of byDepth([[-124, -24], [-124, 24], [112, -24], [112, 24]])) {
    out.push(L(k.ring(x, y, 2.6, top, P, 20), { tone: "lo" }));
  }
  out.push(D([[-100, 24], [-94, 24], [-88, 24], [-82, 24], [-30, 26], [-24, 26], [-18, 26], [8, -27], [14, -27]].map(([x, y]) => at([x, y, top])), { size: 0.8, tone: "lo" }));
  // Traces between the main parts.
  const traces = [
    [[-38, -4], [-22, -4], [-12, -14], [6, -14]],
    [[-38, 4], [-18, 4], [-8, 14], [6, 14]],
    [[34, 0], [52, 0], [60, -8], [74, -8]],
    [[34, 8], [56, 8], [64, 16], [74, 16]],
    [[-74, -10], [-90, -10], [-98, -18], [-112, -18]],
  ];
  out.push(L(traces.map((t) => k.onTop(t, top, P)).join(""), { tone: "faint" }));
  const parts = [
    // [kind, plan]
    ["mcu", plan(-38, -14, 28, 28, 0.8)],
    ["se", plan(6, -10, 20, 20, 0.6)],
    ["usbctl", plan(74, -12, 14, 14, 0.5)],
    ["inductor", plan(-108, -8, 16, 16, 2)],
    ["xtal", plan(40, 16, 10, 6, 0.6)],
    ["chipant", plan(-60, 18, 14, 6, 0.6)],
  ];
  const items = byDepth(parts, ([, p]) => centreOf(p));
  for (const [kind, p] of items) {
    if (kind === "mcu") out.push(`<g class="lg-good">${chip(p, top, 2.6, { tone: "hi", pins: 7 })}</g>`);
    else if (kind === "se") out.push(`<g class="lg-good">${chip(p, top, 2.2, { tone: "hi", pins: 4 })}</g>`);
    else if (kind === "inductor") {
      out.push(S(k.slabOf(p, top, 7, P, 4, 0.5), { tone: "mid", crease: "lo" }));
      out.push(L(k.ring(p.x + 8, p.y + 8, 5, top + 7, P, 24), { tone: "lo" }));
    } else out.push(chip(p, top, 2, { tone: "mid", dot: kind !== "xtal" }));
  }
  out.push(
    passives(
      [[-46, -22], [-46, 18], [-8, -24], [-4, 20], [30, -22], [30, 18, 1], [58, -20], [62, 22], [-84, 14], [-84, -22, 1], [-70, -4, 1], [96, -22], [96, 20], [-20, 22, 1], [50, -6, 1]],
      top,
    ),
  );
  // USB-C receptacle at the right end, proud of the board edge.
  const usb = plan(110, -16, 26, 32, 3);
  out.push(S(k.slabOf(usb, top, 12, P, 4, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.sideRing([usb.x + usb.w, 0, top + 6], 3.6, "x", P), { tone: "mid" }));
  out.push(D([at([usb.x + 4, usb.y + 4, top + 12]), at([usb.x + 4, usb.y + usb.d - 4, top + 12])], { size: 0.5, tone: "lo" }));
  // OLED flex connector at the left.
  out.push(S(k.slabOf(plan(-86, -22, 10, 36, 1), top, 3, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  return out.join("");
}

function implant() {
  const z = IMPLANT_Z;
  const top = IMPLANT_TOP;
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(IMPLANT, 4), z, 0.1, P)}" style="filter:blur(4px)"/>`];
  // Standoffs onto the main board.
  for (const [x, y] of byDepth(k.corners(IMPLANT, 5))) {
    out.push(S(k.cylinder(x, y, 1.6, PCB_TOP, z - PCB_TOP, P, 12), { tone: "hi", crease: "none", className: "lg-bad" }));
  }
  out.push(`<g class="lg-bad" data-find="extra_board">${S(k.slabOf(IMPLANT, z, top - z, P, 3, 0.4), { tone: "hi", crease: "lo" })}${L(k.planOutline(k.insetPlan(IMPLANT, 2), top, P, 3), { tone: "red" })}</g>`);
  // nRF9151 LTE module under its shield can.
  const can = plan(-6, -20, 44, 36, 1.2);
  out.push(
    `<g class="lg-bad" data-find="cellular_module">${S(k.slabOf(can, top, 4.4, P, 3, 0.6), { tone: "hi", crease: "lo" })}${L(k.planOutline(k.insetPlan(can, 2.2), top + 4.4, P, 3), { tone: "red" })}${k.faceTextSvg(k.topMatrix([can.x + 5, can.y + 12], top + 4.4, P, "x"), "nRF9151", { size: 4.2, tone: "hi" })}${L(
      [16, 22].map((y) => k.lineOnTop([can.x + 5, can.y + y], [can.x + 30, can.y + y], top + 4.4, P)).join(""),
      { tone: "red", free: true },
    )}${D([at([can.x + can.w - 5, can.y + can.d - 5, top + 4.4])], { size: 0.7, tone: "hi" })}</g>`,
  );
  // Second MCU (STM32U575 class) and an eSIM.
  out.push(`<g class="lg-bad" data-find="extra_mcu">${chip(plan(-46, -16, 26, 26, 0.8), top, 2.4, { pins: 6 })}</g>`);
  out.push(`<g class="lg-bad" data-find="esim">${chip(plan(-68, 4, 14, 12, 0.6), top, 2)}</g>`);
  out.push(`<g class="lg-bad">${passives([[-66, -20], [-60, -8, 1], [-20, 14], [-14, 14], [40, 16, 1]], top)}</g>`);
  // U.FL socket and the coax pigtail that drops over the far edge.
  const [sx, sy] = SOCKET;
  out.push(
    `<g class="lg-bad" data-find="antenna_socket">${S(k.slabOf(plan(sx - 4, sy - 4, 8, 8, 0.8), top, 1.2, P, 2), { tone: "hi", crease: "none" })}${S(k.cylinder(sx, sy, 2.8, top + 1.2, 2.2, P, 20), { tone: "hi", crease: "lo" })}${L(k.ring(sx, sy, 1.2, top + 3.4, P, 12), { tone: "red" })}</g>`,
  );
  // Pad where the power-tap wires land.
  out.push(`<g class="lg-bad" data-find="power_tap_wires">${S(k.slabOf(plan(TAP_PAD[0] - 3, TAP_PAD[1] - 3, 6, 6, 1), top, 0.6, P, 2), { tone: "hi", crease: "none" })}</g>`);
  return out.join("");
}

function oled() {
  const z = OLED_Z;
  const top = OLED_TOP;
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(OLED, 4), z, 0.1, P)}" style="filter:blur(4px)"/>`];
  // Flex tail folding down to the connector.
  out.push(S(k.slabOf(plan(-86, -14, 22, 22, 1), z + 1, 0.8, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(OLED, z, top - z, P, 3, 0.5), { tone: "hi", crease: "lo" }));
  const glass = k.insetPlan(OLED, 4);
  out.push(S(k.slabOf(glass, top, 0.2, P, 3), { tone: "lo", crease: "none", flat: true, className: "lg-glass" }));
  // A few lit pixels: the screen reads as a screen.
  out.push(D([[-30, -4], [-26, -4], [-22, -4], [-18, -4], [-30, 4], [-22, 4], [0, 0], [4, 0], [8, 0]].map(([x, y]) => at([x, y, top + 0.2])), { size: 0.6, tone: "mid" }));
  return out.join("");
}

function cover() {
  const z = RIM;
  const top = RIM + COVER_H;
  const out = [`<path class="iso-halo" d="${k.haloOf(SHELL, z, COVER_H, P)}" style="filter:blur(6px)"/>`];
  out.push(S(k.slabOf(SHELL, z, COVER_H, P, 8, 1.2), { tone: "hi", crease: "lo", className: "lg-case" }));
  out.push(L(k.sideSeam(SHELL, z + 4, P, 8), { tone: "faint" }));
  // Screen window and the two buttons.
  const window = plan(-64, -22, 128, 44, 3);
  out.push(S(k.slabOf(window, top, 0.2, P, 3), { tone: "lo", crease: "none", flat: true, className: "lg-glass" }));
  out.push(L(k.planOutline(k.insetPlan(window, -2.4), top, P, 3), { tone: "lo" }));
  for (const x of [-104, 104]) {
    out.push(L(k.ring(x, 0, 15, top, P, 48), { tone: "lo" }));
    out.push(S(k.cylinder(x, 0, 12.4, top, 1.8, P, 48, 0.5), { tone: "mid", crease: "lo" }));
    out.push(L(k.ring(x, 0, 9, top + 1.8, P, 40), { tone: "faint" }));
  }
  return out.join("");
}

// The coax and the tap wires stretch from the lower shell up to the implant as
// it lifts: fixed points, then a tail that rides the implant.
const [SX, SY] = SOCKET;
export const LEADS = {
  coax: { find: "coax_cable", floor: COAX_FLOOR, tail: [[34, LEAD_Y, IMPLANT_Z - 1.2], [SX + 2, LEAD_Y + 2, IMPLANT_Z + 0.6], [SX, SY - 2.8, IMPLANT_TOP + 3]] },
  tap: { find: "power_tap_wires", floor: TAP_FLOOR, tail: [[-92, LEAD_Y, IMPLANT_Z - 1.2], [TAP_PAD[0] - 2, LEAD_Y + 2, IMPLANT_Z + 0.6], [TAP_PAD[0], TAP_PAD[1], IMPLANT_TOP + 0.6]] },
};

export function figure() {
  const group = (name, art) => `<g data-part="${name}">${art}</g>`;
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A Ledger Nano X taken apart on a repair mat. The top cover, the screen and the main board lift out of the lower shell. In a tampered unit an extra board with an LTE modem, a second microcontroller and an eSIM sits on the main board, a coax lead runs over the battery to an antenna glued inside the shell, and red wires tap the battery.",
    body: [
      `<defs><clipPath id="nx-inside"><path d="${sweep(INNER, RIM)}"/></clipPath></defs>`,
      mat(),
      shell(),
      `<g clip-path="url(#nx-inside)">`,
      antenna(),
      battery(),
      tapWires(),
      leadSvg(LEADS.coax, "coax", LEADS.coax.find),
      leadSvg(LEADS.tap, "tap", LEADS.tap.find),
      group("pcb", pcb()),
      group("implant", implant()),
      group("oled", oled()),
      `</g>`,
      group("cover", cover()),
    ],
  });
}

export const NANO_X = { id: "nano_x", title: "Nano X", P, LIFT, STAGGER, SPRING, LEADS, ride: "implant", figure };
