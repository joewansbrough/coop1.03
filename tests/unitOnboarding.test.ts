import assert from 'node:assert/strict';
import {
  UNIT_TEMPLATE_COLUMNS,
  buildUnitTemplateCsv,
  findMissingUnitNumbers,
  getUnitSetupState,
  normalizeUnitTemplateRow,
} from '../utils/unitOnboarding.ts';

assert.deepEqual(UNIT_TEMPLATE_COLUMNS, [
  'unitNumber',
  'buildingName',
  'floor',
  'unitType',
  'status',
]);

const csv = buildUnitTemplateCsv();
assert.equal(csv.split('\n')[0], 'unitNumber,buildingName,floor,unitType,status');
assert.ok(csv.includes('101,Main Building,1,1BR,Vacant'));

assert.deepEqual(normalizeUnitTemplateRow({
  unitNumber: ' 107 ',
  buildingName: ' Oak Bay ',
  floor: '2',
  unitType: ' bachelor ',
  status: ' occupied ',
}), {
  unitNumber: '107',
  buildingName: 'Oak Bay',
  floor: 2,
  unitType: 'BACHELOR',
  status: 'Occupied',
});

assert.deepEqual(normalizeUnitTemplateRow({
  unitNumber: 'A',
  floor: 'not-a-number',
}), {
  unitNumber: 'A',
  buildingName: '',
  floor: 1,
  unitType: '2BR',
  status: 'Vacant',
});

const emptyState = getUnitSetupState([]);
assert.equal(emptyState.isEmpty, true);
assert.equal(emptyState.title, 'Create the unit backbone first');
assert.equal(emptyState.primaryActionLabel, 'Add first unit');

const populatedState = getUnitSetupState([{ id: 'u1', number: '101', type: '1BR', floor: 1, status: 'Vacant' }]);
assert.equal(populatedState.isEmpty, false);
assert.equal(populatedState.title, 'Units are ready for member import');

assert.deepEqual(findMissingUnitNumbers(
  [
    { number: '101' },
    { number: '102' },
  ],
  ['101', ' 102 ', '103', '', '103', 'A1'],
), ['103', 'A1']);

console.log('unitOnboarding tests passed');
