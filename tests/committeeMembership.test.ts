import assert from 'node:assert/strict';
import test from 'node:test';
import { getTenantCommitteeAssignments } from '../utils/committeeMembership.ts';
import type { Committee, Tenant } from '../types.ts';

const tenant: Tenant = {
  id: 't1',
  firstName: 'Margaret',
  lastName: 'Chen',
  email: 'margaret@example.com',
  startDate: '2020-01-01',
  status: 'Current',
  role: 'Member',
};

test('derives tenant committee assignments from committee member names', () => {
  const committees = [
    { id: 'c2', name: 'Finance Committee', description: '', chair: '', icon: '', members: ['Patricia MacLeod', 'Margaret Chen'] },
    { id: 'c1', name: 'Board of Directors', description: '', chair: '', icon: '', members: ['George Papadopoulos'] },
  ] satisfies Committee[];

  assert.deepEqual(
    getTenantCommitteeAssignments(tenant, committees).map(committee => committee.name),
    ['Finance Committee'],
  );
});

test('handles committee members returned as tenant objects', () => {
  const committees = [
    { id: 'c1', name: 'Board of Directors', description: '', chair: '', icon: '', members: [{ firstName: 'Margaret', lastName: 'Chen' }] },
  ] satisfies Committee[];

  assert.equal(getTenantCommitteeAssignments(tenant, committees)[0].id, 'c1');
});
