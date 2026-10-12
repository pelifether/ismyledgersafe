// A canned answer for local work without an API key.
export function mock(count) {
  return {
    device: "nano_x",
    verdict: "tampered",
    confidence: "high",
    findings: [
      { code: "cellular_module", photo: 1, box: [420, 380, 640, 560], detail: "Shield can, likely Nordic nRF9151 LTE module" },
      { code: "extra_mcu", photo: 1, box: [440, 600, 600, 720], detail: "STM32U575 beside the modem" },
      { code: "antenna_socket", photo: 1, box: [600, 300, 660, 350], detail: "U.FL socket at board edge" },
      { code: "coax_cable", photo: Math.min(2, count), box: [500, 200, 700, 700], detail: "Black coax over the battery" },
      { code: "antenna_in_case", photo: Math.min(2, count), box: [700, 150, 900, 400], detail: "Antenna AC-A2205-NANO-X in back cover" },
    ],
    antenna_sku: "AC-A2205-NANO-X 欧亚版-V1.0",
    missing_views: ["board_bottom"],
    summary: "Mock result: an LTE implant with its own antenna is visible. Do not use this device.",
    observations: "mock",
  };
}
