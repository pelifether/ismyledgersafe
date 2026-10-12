// Ledger Stax opened on a teardown mat, drawn with the anatomy kit.
// World units: 1 mm = 3 units. The chassis lies face down (E Ink side on the
// mat); its back cover lies beside it, inner face up. The genuine stack in the
// chassis is: E Ink panel, battery and main board side by side, Qi/NFC coil
// flex over both. The spyware build adds, in red: an implant board on the main
// board (nRF9151 LTE module, MCU, eSIM, U.FL socket), a coax taped over the
// battery, and an antenna glued inside the back cover (AC-A2014-STAX-V1.1).
import * as k from "./kit/iso-kit.mjs";
import { centreOf, plan, poly, tools } from "./tools.mjs";

const WIDTH = 640;
const HEIGHT = 470;
const MM = 3;

const CHASSIS = { x: -275, y: -81, w: 255, d: 162, r: 12 };
const RIM = 18;
const INNER = k.insetPlan(CHASSIS, 4);
const FLOOR = 3;

const BACK = { x: 20, y: -81, w: 255, d: 162, r: 12 };
const BACK_RIM = 8;
const BACK_INNER = k.insetPlan(BACK, 4);
const BACK_FLOOR = 2;

const MAT = { x: -300, y: -112, w: 600, d: 240, r: 8 };
const MAT_H = 4;

const BATTERY = { x: -118, y: -66, w: 90, d: 132, r: 4 };
const BATTERY_TOP = FLOOR + 8;

const PCB = { x: -264, y: -73, w: 136, d: 146, r: 6 };
const PCB_Z = 5;
const PCB_TOP = PCB_Z + 2;

const IMPLANT = { x: -240, y: -62, w: 84, d: 76, r: 3 };
const IMPLANT_Z = PCB_TOP + 2.6;
const IMPLANT_TOP = IMPLANT_Z + 1.8;
const SOCKET = [-168, -54];

const COIL = { x: -266, y: -75, w: 242, d: 150, r: 8 };
const COIL_Z = RIM - 0.8;

const ANTENNA = { x: 44, y: -62, w: 112, d: 84, r: 2 };
const FEED = [52, -20];
const LEAD_Y = -76;

// The coil slides back as it lifts, so the implant under it shows.
const LIFT = { coil: [0, -150, 92], implant: 78, pcb: 38 };
const STAGGER = ["coil", "implant", "pcb"];
const SPRING = { stiffness: 64, damping: 14.2, substeps: 4, stagger: 0.07 };

const P = k.fitProjection(
  [...k.boxCorners(MAT, -MAT_H, 0), ...k.boxCorners({ ...COIL, y: COIL.y + LIFT.coil[1] }, COIL_Z + LIFT.coil[2], COIL_Z + LIFT.coil[2] + 2)],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 50, elevation: 34 },
);

const { at, S, L, D, byDepth, chip, passives, cavity, sweep, meander, leadSvg, mat: matOf } = tools(P);

// The coax: from the antenna feed across the back cover, over its rim, across
// the mat, up the chassis wall, taped along the battery, then up to the socket.
const IN_BACK = [[FEED[0], FEED[1], BACK_FLOOR + 0.8], [26, -20, BACK_FLOOR + 0.8], [25, -20, BACK_RIM + 0.6]];
const OUTSIDE = [[25, -20, BACK_RIM + 0.6], [19, -20, BACK_RIM + 0.6], [16, -20, 0.6], [-18, -20, 0.6], [-19.4, -20, RIM + 0.6], [-22, -20, RIM + 0.6]];
const LEADS = {
  coax: {
    find: "coax_cable",
    floor: [[-22, -20, RIM + 0.6], [-26, -20, BATTERY_TOP + 1], [-60, -40, BATTERY_TOP + 1], [-112, -60, BATTERY_TOP + 1], [-124, LEAD_Y, BATTERY_TOP + 2]],
    tail: [[-140, LEAD_Y, IMPLANT_Z - 1.2], [SOCKET[0] + 2, LEAD_Y + 2, IMPLANT_Z + 0.6], [SOCKET[0], SOCKET[1] - 2.8, IMPLANT_TOP + 3]],
  },
};

const mat = () => matOf(MAT, MAT_H, MM, [[-240, 96], [262, 98]], [[-244, 94], [-236, 99]]);

function chassis() {
  const out = [`<path class="iso-halo" d="${k.haloOf(CHASSIS, 0, RIM, P)}"/>`];
  out.push(S(k.slabOf(CHASSIS, 0, RIM, P, 10, 1), { tone: "mid", crease: "lo", className: "lg-case" }));
  // The aluminium band and the E Ink spine along the near long side.
  out.push(L(k.sideSeam(CHASSIS, 6, P, 10), { tone: "faint" }));
  out.push(L(k.sideRing([CHASSIS.x + CHASSIS.w, 40, 9], 3.4, "x", P), { tone: "lo" }));
  out.push(cavity(INNER, RIM, FLOOR, 10));
  return out.join("");
}

function panel() {
  // The back of the E Ink panel on the chassis floor, with its flex.
  const back = k.insetPlan(INNER, 6);
  const out = [S(k.slabOf(back, FLOOR, 0.6, P, 6), { tone: "lo", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(back, 6), FLOOR + 0.6, P, 6), { tone: "faint" }));
  return out.join("");
}

function battery() {
  const top = BATTERY_TOP;
  const out = [S(k.slabOf(BATTERY, FLOOR, top - FLOOR, P, 4, 0.8), { tone: "mid", crease: "lo", className: "lg-cell" })];
  out.push(L(k.planOutline(k.insetPlan(BATTERY, 5), top, P, 4), { tone: "faint" }));
  out.push(L([0, 8, 16, 24].map((dy, i) => k.lineOnTop([-100, 20 + dy], [i % 2 ? -64 : -48, 20 + dy], top, P)).join(""), { tone: "lo", free: true }));
  // Protection board at the far end.
  out.push(S(k.slabOf(plan(-110, -66, 74, 10, 1.5), top, 1.6, P, 2, 0.3), { tone: "mid", crease: "lo" }));
  return out.join("");
}

function tape() {
  return `<g class="lg-bad" data-find="coax_cable">${S(k.slabOf(plan(-72, -50, 16, 20, 1), BATTERY_TOP, 1.8, P, 2), { tone: "hi", crease: "none" })}</g>`;
}

function pcb() {
  const z = PCB_Z;
  const top = PCB_TOP;
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(PCB, 4), z, 0.1, P)}" style="filter:blur(5px)"/>`];
  out.push(S(k.slabOf(PCB, z, top - z, P, 6, 0.4), { tone: "mid", crease: "lo", className: "lg-board" }));
  // Gold shield frame and mounting holes.
  out.push(L(k.planOutline(k.insetPlan(PCB, 3), top, P, 6), { tone: "lo" }));
  for (const [x, y] of byDepth([[-256, -65], [-256, 65], [-136, -65], [-136, 65], [-196, 50]])) {
    out.push(L(k.ring(x, y, 3.4, top, P, 20), { tone: "lo" }));
    out.push(L(k.ring(x, y, 1.6, top, P, 14), { tone: "faint" }));
  }
  const parts = [
    ["mcu", plan(-230, 22, 26, 26, 0.8)],
    ["se", plan(-190, 26, 18, 18, 0.6)],
    ["nfc", plan(-158, 28, 14, 14, 0.5)],
    ["fpc", plan(-250, -70, 60, 8, 1)],
    ["touch", plan(-150, -8, 8, 26, 1)],
  ];
  for (const [kind, p] of byDepth(parts, ([, p]) => centreOf(p))) {
    if (kind === "mcu") out.push(`<g class="lg-good">${chip(p, top, 2.4, { pins: 6 })}</g>`);
    else if (kind === "se") out.push(`<g class="lg-good">${chip(p, top, 2, { pins: 4 })}</g>`);
    else if (kind === "fpc" || kind === "touch") out.push(S(k.slabOf(p, top, 2.4, P, 2, 0.3), { tone: "mid", crease: "lo" }));
    else out.push(chip(p, top, 1.8, { tone: "mid" }));
  }
  out.push(passives([[-246, 54], [-238, 60, 1], [-212, 56], [-176, 56], [-168, 12, 1], [-206, 10], [-142, 52], [-142, 40, 1], [-250, 6, 1], [-176, 4]], top));
  out.push(D([[-258, 30], [-258, 36], [-258, 42], [-132, -40], [-132, -34]].map(([x, y]) => at([x, y, top])), { size: 0.8, tone: "lo" }));
  return out.join("");
}

function implant() {
  const z = IMPLANT_Z;
  const top = IMPLANT_TOP;
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(IMPLANT, 4), z, 0.1, P)}" style="filter:blur(4px)"/>`];
  for (const [x, y] of byDepth(k.corners(IMPLANT, 5))) {
    out.push(S(k.cylinder(x, y, 1.4, PCB_TOP, z - PCB_TOP, P, 12), { tone: "hi", crease: "none", className: "lg-bad" }));
  }
  out.push(`<g class="lg-bad" data-find="extra_board">${S(k.slabOf(IMPLANT, z, top - z, P, 3, 0.4), { tone: "hi", crease: "lo" })}${L(k.planOutline(k.insetPlan(IMPLANT, 2), top, P, 3), { tone: "red" })}</g>`);
  const can = plan(-226, -52, 36, 44, 1.2);
  out.push(
    `<g class="lg-bad" data-find="cellular_module">${S(k.slabOf(can, top, 3.6, P, 3, 0.5), { tone: "hi", crease: "lo" })}${L(k.planOutline(k.insetPlan(can, 2), top + 3.6, P, 3), { tone: "red" })}${k.faceTextSvg(k.topMatrix([can.x + 4, can.y + 10], top + 3.6, P, "x"), "nRF9151", { size: 3.4, tone: "hi" })}${L(
      [16, 22].map((y) => k.lineOnTop([can.x + 4, can.y + y], [can.x + 24, can.y + y], top + 3.6, P)).join(""),
      { tone: "red", free: true },
    )}</g>`,
  );
  out.push(`<g class="lg-bad" data-find="extra_mcu">${chip(plan(-184, -48, 20, 20, 0.7), top, 2, { pins: 5 })}</g>`);
  out.push(`<g class="lg-bad" data-find="esim">${chip(plan(-224, -2, 12, 10, 0.5), top, 1.8)}</g>`);
  out.push(`<g class="lg-bad">${passives([[-200, 2], [-194, 2], [-180, -20, 1], [-172, -20, 1]], top)}</g>`);
  const [sx, sy] = SOCKET;
  out.push(
    `<g class="lg-bad" data-find="antenna_socket">${S(k.slabOf(plan(sx - 3.5, sy - 3.5, 7, 7, 0.8), top, 1, P, 2), { tone: "hi", crease: "none" })}${S(k.cylinder(sx, sy, 2.4, top + 1, 2, P, 20), { tone: "hi", crease: "lo" })}${L(k.ring(sx, sy, 1, top + 3, P, 12), { tone: "red" })}</g>`,
  );
  return out.join("");
}

function coil() {
  const z = COIL_Z;
  const top = z + 0.8;
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(COIL, 6), z, 0.1, P)}" style="filter:blur(5px)"/>`];
  out.push(S(k.slabOf(COIL, z, top - z, P, 6), { tone: "mid", crease: "lo", className: "lg-flex" }));
  // The Qi/NFC winding: nested loops round the middle of the card.
  const loops = [];
  for (let i = 0; i < 7; i++) loops.push(k.planOutline({ x: -246 + i * 5, y: -60 + i * 5, w: 202 - i * 10, d: 120 - i * 10, r: 12 - i }, top, P, 6));
  out.push(L(loops.join(""), { tone: "lo" }));
  out.push(D([at([-144, -2, top]), at([-136, -2, top])], { size: 0.7, tone: "mid" }));
  return out.join("");
}

function back() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BACK, 0, BACK_RIM, P)}"/>`];
  out.push(S(k.slabOf(BACK, 0, BACK_RIM, P, 10, 0.8), { tone: "mid", crease: "lo", className: "lg-case" }));
  out.push(cavity(BACK_INNER, BACK_RIM, BACK_FLOOR, 10));
  // Magnet pads and the moulding marks on the inside.
  for (const [x, y] of byDepth([[220, -50], [220, 50], [196, 0]])) out.push(L(k.ring(x, y, 7, BACK_FLOOR, P, 28), { tone: "lo" }));
  return out.join("");
}

function antenna() {
  const z = BACK_FLOOR;
  const out = [meander(ANTENNA, z)];
  out.push(k.faceTextSvg(k.topMatrix([ANTENNA.x + 4, ANTENNA.y + ANTENNA.d - 4], z + 0.6, P, "x"), "AC-A2014-STAX-V1.1", { size: 3.4, tone: "lo" }));
  out.push(S(k.slabOf(plan(FEED[0] - 4, FEED[1] - 4, 8, 8, 1), z + 0.6, 0.6, P, 2), { tone: "hi", crease: "none" }));
  return `<g class="lg-bad" data-find="antenna_in_case">${out.join("")}</g>`;
}

const wire = (points) => `<g class="lg-bad lg-lead" data-find="coax_cable"><path class="iso-line" data-tone="red" d="${poly(points.map(at), false)}"/></g>`;

function figure() {
  const group = (name, art) => `<g data-part="${name}">${art}</g>`;
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A Ledger Stax opened on a repair mat, its back cover lying beside it. The Qi/NFC coil and the main board lift out of the chassis. In a tampered unit an extra board with an LTE modem, a second microcontroller and an eSIM sits on the main board, and a coax lead taped over the battery runs to an antenna glued inside the back cover.",
    body: [
      `<defs><clipPath id="sx-inside"><path d="${sweep(INNER, RIM, 10)}"/></clipPath><clipPath id="sx-back"><path d="${sweep(BACK_INNER, BACK_RIM, 10)}"/></clipPath></defs>`,
      mat(),
      chassis(),
      wire(OUTSIDE),
      back(),
      `<g clip-path="url(#sx-back)">`,
      antenna(),
      wire(IN_BACK),
      `</g>`,
      `<g clip-path="url(#sx-inside)">`,
      panel(),
      battery(),
      leadSvg(LEADS.coax, "coax", LEADS.coax.find),
      tape(),
      group("pcb", pcb()),
      group("implant", implant()),
      `</g>`,
      group("coil", coil()),
    ],
  });
}

export const STAX = { id: "stax", title: "Stax", P, LIFT, STAGGER, SPRING, LEADS, ride: "implant", figure };
