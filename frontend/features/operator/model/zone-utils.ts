import { Machine } from '@/features/operator/model/machine-data';

export function normalizeZoneName(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

export function filterMachinesByZone(machines: Machine[], zone: string): Machine[] {
  if (machines.length === 0) return [];

  const zoneKey = normalizeZoneName(zone);
  if (!zoneKey || zoneKey === 'all zones') {
    return machines;
  }

  const exactMatches = machines.filter(
    (machine) => normalizeZoneName(machine.zone) === zoneKey,
  );
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const fuzzyMatches = machines.filter((machine) =>
    normalizeZoneName(machine.zone).includes(zoneKey) ||
    zoneKey.includes(normalizeZoneName(machine.zone)),
  );

  return fuzzyMatches.length > 0 ? fuzzyMatches : machines;
}
