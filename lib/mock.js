// A canned answer for local work without an API key.
export function mock(count) {
  return {
    device: "nano_x",
    board_visible: true,
    verdict: "implant_found",
    confidence: "high",
    findings: [
      { code: "cellular_module", photo: 1, box: [420, 380, 640, 560], detail: "Silver shield can, Nordic nRF9151 LTE module" },
      { code: "stacked_board", photo: 1, box: [300, 300, 700, 700], detail: "Second board stacked on the original" },
      { code: "antenna_cable", photo: 1, box: [600, 300, 660, 350], detail: "U.FL socket with coax" },
      { code: "antenna_in_case", photo: Math.min(2, count), box: [700, 150, 900, 400], detail: "Antenna AC-A2016-NANO-V1.1 in the case" },
    ],
    antenna_sku: "AC-A2016-NANO-V1.1",
    retake: [],
    summary: "Mock result: a second board with an LTE module and antenna sits on this board.",
  };
}
