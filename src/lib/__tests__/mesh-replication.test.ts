import { describe, it, expect, beforeEach } from 'vitest';
import {
  compareVectorClocks,
  mergeVectorClocks,
  incrementVectorClock,
  computeDeltaChecksum,
  mergeAllergies,
  verifyMeshToken,
  signMeshPayload,
  verifyMeshSignature,
  recordLocalDelta,
  applyInboundDeltas,
  getPendingOutboxDeltas,
  acknowledgeOutboxDeltas,
  getLocalNodeIdentity,
} from '@/lib/mesh-replication';
import { sqlite } from '@/db';
import { MeshDelta } from '@/types';

describe('Multi-Branch Clinic Mesh Replication Subsystem', () => {
  const secretKey = 'fips-test-mesh-replication-cluster-secret-key-32b';

  beforeEach(() => {
    // Clean test state for mesh tables
    try {
      sqlite.prepare('DELETE FROM mesh_outbox_queue').run();
      sqlite.prepare('DELETE FROM mesh_delta_log').run();
      sqlite.prepare('DELETE FROM mesh_nodes').run();
    } catch {}
  });

  describe('Vector Clock Causal Ordering', () => {
    it('correctly identifies EQUAL vector clocks', () => {
      const v1 = { hub: 5, satellite_1: 3 };
      const v2 = { hub: 5, satellite_1: 3 };
      expect(compareVectorClocks(v1, v2)).toBe('EQUAL');
    });

    it('correctly identifies BEFORE causality', () => {
      const v1 = { hub: 5, satellite_1: 3 };
      const v2 = { hub: 6, satellite_1: 3 };
      expect(compareVectorClocks(v1, v2)).toBe('BEFORE');

      const v3 = { hub: 5, satellite_1: 3 };
      const v4 = { hub: 5, satellite_1: 4, satellite_2: 1 };
      expect(compareVectorClocks(v3, v4)).toBe('BEFORE');
    });

    it('correctly identifies AFTER causality', () => {
      const v1 = { hub: 7, satellite_1: 4 };
      const v2 = { hub: 5, satellite_1: 3 };
      expect(compareVectorClocks(v1, v2)).toBe('AFTER');
    });

    it('correctly detects CONCURRENT divergent edits across branches', () => {
      // Hub has mutation 6 (satellite hasn't seen), Satellite has mutation 4 (hub hasn't seen)
      const hubClock = { hub: 6, satellite: 3 };
      const satClock = { hub: 5, satellite: 4 };
      expect(compareVectorClocks(hubClock, satClock)).toBe('CONCURRENT');
    });

    it('merges vector clocks by taking pairwise maximum', () => {
      const v1 = { node_a: 10, node_b: 4, node_c: 2 };
      const v2 = { node_a: 8, node_b: 6, node_d: 1 };
      const merged = mergeVectorClocks(v1, v2);

      expect(merged).toEqual({
        node_a: 10,
        node_b: 6,
        node_c: 2,
        node_d: 1,
      });
    });

    it('increments monotonic node clock accurately', () => {
      const clock = { node_a: 3, node_b: 1 };
      const updated = incrementVectorClock(clock, 'node_a');
      expect(updated.node_a).toBe(4);
      expect(updated.node_b).toBe(1);

      const brandNew = incrementVectorClock(clock, 'node_c');
      expect(brandNew.node_c).toBe(1);
    });
  });

  describe('Conflict-Free CRDT Allergy Merging', () => {
    it('unions distinct allergies without losing any entries', () => {
      const branchA = 'Penicillin, Aspirin';
      const branchB = 'Sulfa drugs, Diclofenac';
      const merged = mergeAllergies(branchA, branchB);

      expect(merged).toContain('Penicillin');
      expect(merged).toContain('Aspirin');
      expect(merged).toContain('Sulfa drugs');
      expect(merged).toContain('Diclofenac');
    });

    it('deduplicates overlapping allergy entries cleanly', () => {
      const branchA = 'Penicillin, NSAIDs';
      const branchB = 'Penicillin, Dust Mites';
      const merged = mergeAllergies(branchA, branchB);

      const items = merged.split(', ').sort();
      expect(items).toEqual(['Dust Mites', 'NSAIDs', 'Penicillin'].sort());
    });

    it('handles empty or null allergy strings safely', () => {
      expect(mergeAllergies('', 'Latex')).toBe('Latex');
      expect(mergeAllergies(null, 'Peanuts')).toBe('Peanuts');
      expect(mergeAllergies(undefined, null)).toBe('');
    });
  });

  describe('HMAC Integrity & Constant-Time Token Security', () => {
    it('verifies valid pre-shared cluster tokens', () => {
      expect(verifyMeshToken('cluster-secret-12345', 'cluster-secret-12345')).toBe(true);
      expect(verifyMeshToken('wrong-secret-token', 'cluster-secret-12345')).toBe(false);
      expect(verifyMeshToken('', 'cluster-secret-12345')).toBe(false);
      expect(verifyMeshToken(undefined, 'cluster-secret-12345')).toBe(false);
    });

    it('signs and verifies payload HMAC-SHA256 signatures', () => {
      const payload = JSON.stringify({ action: 'SYNC', deltas: [{ id: 1 }] });
      const signature = signMeshPayload(payload, secretKey);

      expect(verifyMeshSignature(payload, signature, secretKey)).toBe(true);
      // Rejects payload if altered by 1 character
      expect(verifyMeshSignature(payload + ' ', signature, secretKey)).toBe(false);
      // Rejects if verified with wrong secret
      expect(verifyMeshSignature(payload, signature, 'wrong-cluster-secret')).toBe(false);
    });

    it('computes deterministic delta checksums', () => {
      const deltaData = {
        deltaId: 'test-delta-001',
        originNodeId: 'branch_pune',
        targetTable: 'patients',
        recordKey: 'phone:9876543210',
        operation: 'UPDATE' as const,
        payload: { allergies: 'Penicillin' },
        changeTimestamp: 1720000000000,
      };

      const c1 = computeDeltaChecksum(deltaData);
      const c2 = computeDeltaChecksum(deltaData);
      expect(c1).toBe(c2);
      expect(c1).toHaveLength(64);

      // Mutating payload changes checksum
      const modified = { ...deltaData, payload: { allergies: 'Penicillin, Sulfa' } };
      expect(computeDeltaChecksum(modified)).not.toBe(c1);
    });
  });

  describe('Local Delta Recording & Store-and-Forward Outbox', () => {
    it('records local delta and queues outbox item for active peer nodes', () => {
      // Register a peer node
      sqlite.prepare(`
        INSERT INTO mesh_nodes (node_id, name, branch_type, endpoint_url, cluster_secret, status, vector_clock, created_at, updated_at)
        VALUES ('branch_sat_1', 'Satellite Clinic 1', 'SATELLITE', 'https://sat1.clinic.lan', 'secret-key', 'ACTIVE', '{}', ?, ?)
      `).run(Date.now(), Date.now());

      const delta = recordLocalDelta('patients', 'phone:9988776655', 'INSERT', {
        id: 999,
        name: 'Ramesh Patel',
        age: 45,
        gender: 'Male',
        phone: '9988776655',
      });

      expect(delta.deltaId).toBeDefined();
      expect(delta.targetTable).toBe('patients');

      // Verify outbox queued
      const pending = getPendingOutboxDeltas('branch_sat_1');
      expect(pending.length).toBe(1);
      expect(pending[0].deltaId).toBe(delta.deltaId);
      expect(pending[0].recordKey).toBe('phone:9988776655');

      // Acknowledge outbox
      acknowledgeOutboxDeltas('branch_sat_1', [delta.deltaId]);
      const remaining = getPendingOutboxDeltas('branch_sat_1');
      expect(remaining.length).toBe(0);
    });
  });

  describe('Inbound Reconciliation & Conflict Resolution', () => {
    it('applies non-conflicting inbound delta smoothly', () => {
      const now = Date.now();
      const deltaId = 'inbound-delta-nonconflict-001';
      const inboundPayload = {
        id: 991,
        name: 'Suresh Raina',
        age: 38,
        gender: 'Male',
        phone: '9123456780',
        allergies: 'Ciprofloxacin',
      };

      const checksum = computeDeltaChecksum({
        deltaId,
        originNodeId: 'branch_remote_camp',
        targetTable: 'patients',
        recordKey: 'id:991',
        operation: 'INSERT',
        payload: inboundPayload,
        changeTimestamp: now,
      });

      const inboundDelta: MeshDelta = {
        deltaId,
        originNodeId: 'branch_remote_camp',
        targetTable: 'patients',
        recordKey: 'id:991',
        operation: 'INSERT',
        payload: inboundPayload,
        vectorClock: { branch_remote_camp: 1 },
        changeTimestamp: now,
        checksumSha256: checksum,
      };

      const result = applyInboundDeltas('branch_remote_camp', [inboundDelta]);
      expect(result.appliedCount).toBe(1);
      expect(result.conflictCount).toBe(0);
      expect(result.updatedVectorClock.branch_remote_camp).toBe(1);

      // Verify patient was inserted in SQLite
      const patient = sqlite.prepare('SELECT name, allergies FROM patients WHERE id = 991').get() as { name: string; allergies: string };
      expect(patient).toBeDefined();
      expect(patient.name).toBe('Suresh Raina');
      expect(patient.allergies).toBe('Ciprofloxacin');

      // Clean up
      sqlite.prepare('DELETE FROM patients WHERE id = 991').run();
    });

    it('resolves concurrent conflicting edits on patient allergies via set union', () => {
      const now = Date.now();

      // Local edit: Patient has Penicillin allergy
      const localDelta = recordLocalDelta('patients', 'patient:777', 'UPDATE', {
        id: 777,
        allergies: 'Penicillin',
      });

      // Concurrent remote edit: remote branch recorded Sulfa drugs concurrently
      const remoteDeltaId = 'remote-concurrent-allergy-delta';
      const remotePayload = {
        id: 777,
        allergies: 'Sulfa drugs',
      };

      const remoteClock = { branch_pune: 1 }; // Divergent clock
      const checksum = computeDeltaChecksum({
        deltaId: remoteDeltaId,
        originNodeId: 'branch_pune',
        targetTable: 'patients',
        recordKey: 'patient:777',
        operation: 'UPDATE',
        payload: remotePayload,
        changeTimestamp: now + 500, // Concurrent edit
      });

      const remoteDelta: MeshDelta = {
        deltaId: remoteDeltaId,
        originNodeId: 'branch_pune',
        targetTable: 'patients',
        recordKey: 'patient:777',
        operation: 'UPDATE',
        payload: remotePayload,
        vectorClock: remoteClock,
        changeTimestamp: now + 500,
        checksumSha256: checksum,
      };

      const result = applyInboundDeltas('branch_pune', [remoteDelta]);
      expect(result.conflictCount).toBe(1);
      expect(result.conflictsResolved.length).toBe(1);
      expect(result.conflictsResolved[0].resolution).toBe('ALLERGIES_MERGED');

      // Check the delta log record: payload should contain union of both allergies
      const recorded = sqlite
        .prepare('SELECT payload FROM mesh_delta_log WHERE delta_id = ?')
        .get(remoteDeltaId) as { payload: string };
      
      const parsed = JSON.parse(recorded.payload);
      expect(parsed.allergies).toContain('Penicillin');
      expect(parsed.allergies).toContain('Sulfa drugs');
    });

    it('skips tampered deltas with invalid checksums', () => {
      const now = Date.now();
      const fakeDelta: MeshDelta = {
        deltaId: 'tampered-delta-999',
        originNodeId: 'branch_hostile',
        targetTable: 'patients',
        recordKey: 'id:123',
        operation: 'DELETE',
        payload: { id: 123 },
        vectorClock: { branch_hostile: 5 },
        changeTimestamp: now,
        checksumSha256: '0000000000000000000000000000000000000000000000000000000000000000', // Invalid fake hash
      };

      const result = applyInboundDeltas('branch_hostile', [fakeDelta]);
      expect(result.skippedCount).toBe(1);
      expect(result.appliedCount).toBe(0);

      // Verify not stored in log
      const logged = sqlite.prepare('SELECT id FROM mesh_delta_log WHERE delta_id = ?').get(fakeDelta.deltaId);
      expect(logged).toBeUndefined();
    });
  });
});
