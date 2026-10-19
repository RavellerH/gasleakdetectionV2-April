// Mirrors apps/backend/src/modules/devices/gas-class.ts (PertaminaGLD GAS_CLASS).
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

// Confidence that counts toward a gas alert. A confident "Clean Air" (class 0)
// result is not a leak, matching the backend riskLevel rule (aiClass !== 0).
export function gasAlertConfidence(d: { latestConfidence?: number | null; latestGasClass?: number | null }): number {
  if (d.latestGasClass === null || d.latestGasClass === undefined || d.latestGasClass === 0) return 0;
  return d.latestConfidence ?? 0;
}
