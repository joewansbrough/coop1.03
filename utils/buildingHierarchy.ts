import type { Building, Unit } from '../types';

export type UnitsByBuildingAndFloor = Record<string, Record<number, Unit[]>>;

export const groupUnitsByBuildingAndFloor = (
  units: Unit[],
  buildings: Building[] = [],
): UnitsByBuildingAndFloor => {
  const buildingById = new Map(buildings.map(building => [building.id, building]));
  return [...units]
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
    .reduce((acc, unit) => {
      const buildingName = (unit.buildingId && buildingById.get(unit.buildingId)?.name) || unit.building?.name || 'Building';
      const floor = unit.floor || 0;
      acc[buildingName] = acc[buildingName] || {};
      acc[buildingName][floor] = [...(acc[buildingName][floor] || []), unit];
      return acc;
    }, {} as UnitsByBuildingAndFloor);
};
