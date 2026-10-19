// Gas class codes as decoded by the PertaminaGLD Node-RED flow
// (server/nodered/functions/pertamina-gld-decode.js, GAS_CLASS). The current
// on-device model (Technical Datasheet Rev 4.0) only emits 0, 1 and 7.
export const GAS_CLASS_NAMES: Record<number, string> = {
  0: 'Clean Air',
  1: 'LPG',
  2: 'Methane',
  3: 'Propane',
  4: 'Butane',
  5: 'Reserved',
  6: 'Anomaly',
  7: 'H2',
};

export function gasClassName(aiClass: number | null | undefined): string {
  if (aiClass === null || aiClass === undefined) return 'Unknown';
  return GAS_CLASS_NAMES[aiClass] ?? `Unknown (${aiClass})`;
}
