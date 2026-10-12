// Drawing helpers shared by the device figures, bound to one projection.
import * as k from "./kit/iso-kit.mjs";

export const plan = (x, y, w, d, r = 0.6) => ({ x, y, w, d, r });
export const centreOf = (p) => [p.x + p.w / 2, p.y + p.d / 2];
export const poly = (points, closed = true) => "M" + points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + (closed ? "Z" : "");

function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export function tools(P) {
  const at = (point) => k.iso(point, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const byDepth = (items, pick = (item) => item) =>
    [...items].sort((a, b) => k.depthOf([...pick(a).slice(0, 2), 0], P) - k.depthOf([...pick(b).slice(0, 2), 0], P));

  // A chip: a low slab, pins on the visible sides and a pin-1 dot.
  function chip(p, z, h, { tone = "hi", pins = 0, dot = true, lit = false, className } = {}) {
    const out = [S(k.slabOf(p, z, h, P, 2, 0.4), { tone, crease: "lo", lit, className })];
    if (pins) {
      const legs = [];
      for (let index = 1; index <= pins; index++) {
        const sx = p.x + (p.w / (pins + 1)) * index;
        const sy = p.y + (p.d / (pins + 1)) * index;
        legs.push(k.lineOnTop([sx, p.y + p.d], [sx, p.y + p.d + 1.6], z, P));
        legs.push(k.lineOnTop([p.x + p.w, sy], [p.x + p.w + 1.6, sy], z, P));
      }
      out.push(L(legs.join(""), { tone: "lo" }));
    }
    if (dot) out.push(D([at([p.x + 2.4, p.y + 2.4, z + h])], { size: 0.5, tone: "mid" }));
    return out.join("");
  }

  // 0402 passives as 4 x 2 slabs; [x, y, turned].
  const passives = (list, z) =>
    byDepth(list)
      .map(([x, y, turn]) => S(k.slabOf(turn ? plan(x, y, 2.2, 4.2, 0.3) : plan(x, y, 4.2, 2.2, 0.3), z, 1.6, P, 2), { tone: "mid", crease: "none" }))
      .join("");

  // An open tray seen from above: the opening, then its floor.
  const opening = (inner, rim, steps = 8) => k.ringOf(inner, steps).map(([x, y]) => at([x, y, rim]));
  const cavity = (inner, rim, floor, steps = 8) =>
    `<path class="lg-wall" d="${poly(opening(inner, rim, steps))}"/>` +
    S(k.slabOf(inner, floor - 0.1, 0.1, P, steps), { tone: "lo", crease: "none", flat: true, className: "lg-floor" }) +
    L(k.planOutline(inner, rim, P, steps), { tone: "lo" });

  // The opening swept straight up the screen: anything inside the tray is seen
  // only through it, and anything that has lifted clear is never cut.
  const sweep = (inner, rim, steps = 8) => {
    const ring = opening(inner, rim, steps);
    return poly(hull([...ring, ...ring.map(([x, y]) => [x, y - 2000])]));
  };

  // A flat LTE antenna sticker with a meander trace and its feed pad.
  function meander(p, z) {
    const x0 = p.x + 6;
    const x1 = p.x + p.w - 6;
    let y = p.y + 6;
    let left = true;
    const path = [[x0, y]];
    while (y + 8 < p.y + p.d - 12) {
      path.push([left ? x1 : x0, y]);
      y += 8;
      path.push([left ? x1 : x0, y]);
      left = !left;
    }
    return S(k.slabOf(p, z, 0.6, P, 3), { tone: "hi", crease: "none" }) + L(k.onTop(path, z + 0.6, P), { tone: "red" }) + D([at([...path[0], z + 0.6])], { size: 0.7, tone: "hi" });
  }

  // A lead that stretches as the implant lifts: fixed points, then a tail that
  // rides the implant.
  const leadPath = (lead, lift) => poly([...lead.floor, ...lead.tail.map(([x, y, z]) => [x, y, z + lift])].map(at), false);
  const leadSvg = (lead, kind, find) => {
    const start = at(lead.floor[0]);
    return `<g class="lg-bad lg-lead" data-find="${find}"><path class="iso-line" data-lead="${kind}" data-tone="red" d="${leadPath(lead, 0)}"/><circle class="iso-wire-end" cx="${start[0].toFixed(1)}" cy="${start[1].toFixed(1)}" r="1.1"/></g>`;
  };

  // A repair mat with a ruler strip along the near edge.
  function mat(m, h, mm, cups = [], screws = []) {
    const out = [`<path class="iso-halo" d="${k.haloOf(m, -h, h, P)}"/>`];
    out.push(S(k.slabOf(m, -h, h, P, 8, 1.2), { tone: "lo", crease: "faint" }));
    out.push(L(k.planOutline(k.insetPlan(m, 6), 0, P), { tone: "faint" }));
    const strip = { x: m.x + 16, y: m.y + m.d - 16, w: m.w - 32, d: 7, r: 1 };
    out.push(S(k.slabOf(strip, 0, 0.4, P, 3), { tone: "lo", crease: "none" }));
    const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, mm, 5, strip.y + 0.6, 0.4, [2, 4], P);
    out.push(L(ticks.minor, { tone: "faint" }), L(ticks.major, { tone: "lo" }));
    for (const [x, y] of byDepth(cups)) {
      out.push(L(k.ring(x, y, 11, 0, P, 40), { tone: "lo" }));
      out.push(L(k.ring(x, y, 7, 0, P, 32), { tone: "faint" }));
    }
    for (const [x, y] of byDepth(screws)) {
      out.push(S(k.cylinder(x, y, 2.4, 0, 1.4, P, 16), { tone: "mid", crease: "none" }));
      out.push(L(k.lineOnTop([x - 1.4, y], [x + 1.4, y], 1.4, P), { tone: "lo" }));
    }
    out.push(D(k.corners(m, 10).map(([x, y]) => at([x, y, 0])), { size: 0.5, tone: "lo" }));
    return out.join("");
  }

  return { at, S, L, D, byDepth, chip, passives, cavity, sweep, meander, leadPath, leadSvg, mat };
}
