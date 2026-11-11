// JobFill BD - Final Intelligence Add-on 5: Transactional Form Filling & Rollback Manager
// Executes autofill as an atomic, dependency-ordered transaction.
// Supports safe rollback, state snapshots, and idempotent re-execution.

import { FillPlanItem, VerificationEngine } from './verification-engine';
import { FieldRelationshipGraph } from '../intelligence/relationship-graph';

export type TransactionStatus = 'INITIALIZED' | 'IN_PROGRESS' | 'COMMITTED' | 'ROLLED_BACK' | 'FAILED';

export interface FieldSnapshot {
  element: HTMLElement;
  selector: string;
  originalValue: string;
  filledValue: string;
  appliedAt: string;
}

export interface TransactionRecord {
  transactionId: string;
  status: TransactionStatus;
  startedAt: string;
  completedAt?: string;
  snapshots: FieldSnapshot[];
  failedOperations: Array<{ selector: string; reason: string }>;
}

export class TransactionManager {
  private static activeTransactions: Map<string, TransactionRecord> = new Map();

  // Begins a new transactional fill session
  public static beginTransaction(transactionId: string): TransactionRecord {
    const record: TransactionRecord = {
      transactionId,
      status: 'INITIALIZED',
      startedAt: new Date().toISOString(),
      snapshots: [],
      failedOperations: [],
    };
    this.activeTransactions.set(transactionId, record);
    return record;
  }

  // Orders items topologically based on field relationship dependencies
  // (e.g., District must be filled before Upazila; SSC before HSC)
  public static sortInDependencyOrder(items: FillPlanItem[]): FillPlanItem[] {
    return [...items].sort((a, b) => {
      const aDeps = FieldRelationshipGraph.getDependency(a.canonicalId);
      const bDeps = FieldRelationshipGraph.getDependency(b.canonicalId);

      // If B depends on A, A must be filled first
      if (bDeps.includes(a.canonicalId)) return -1;
      // If A depends on B, B must be filled first
      if (aDeps.includes(b.canonicalId)) return 1;

      return 0;
    });
  }

  // Executes the plan items transactionally
  public static async executeTransaction(
    transactionId: string,
    planItems: FillPlanItem[]
  ): Promise<TransactionRecord> {
    const tx = this.activeTransactions.get(transactionId) || this.beginTransaction(transactionId);
    tx.status = 'IN_PROGRESS';

    const orderedItems = this.sortInDependencyOrder(planItems);

    for (const item of orderedItems) {
      if (!item.isApproved) continue;

      const el = item.element;
      const currentVal = (el as HTMLInputElement).value || '';

      // IDEMPOTENCY CHECK: If already filled with the proposed value, skip redundant event firing
      if (currentVal === item.proposedValue) {
        item.status = 'SUCCESS';
        continue;
      }

      // Record pre-mutation snapshot
      const snapshot: FieldSnapshot = {
        element: el,
        selector: item.selector,
        originalValue: currentVal,
        filledValue: item.proposedValue,
        appliedAt: new Date().toISOString(),
      };
      tx.snapshots.push(snapshot);

      // Perform fill
      const success = await VerificationEngine.executeFillItem(item);
      if (!success) {
        tx.failedOperations.push({
          selector: item.selector,
          reason: item.verificationMessage || 'Verification failed',
        });
      }
    }

    tx.status = tx.failedOperations.length === 0 ? 'COMMITTED' : 'FAILED';
    tx.completedAt = new Date().toISOString();
    return tx;
  }

  // Rolls back all modified fields to their pre-transaction values
  public static rollback(transactionId: string): { restoredCount: number; status: TransactionStatus } {
    const tx = this.activeTransactions.get(transactionId);
    if (!tx || tx.snapshots.length === 0) {
      return { restoredCount: 0, status: 'FAILED' };
    }

    let restoredCount = 0;
    // Rollback in reverse order
    for (let i = tx.snapshots.length - 1; i >= 0; i--) {
      const snap = tx.snapshots[i];
      if (document.body.contains(snap.element)) {
        const tag = snap.element.tagName.toLowerCase();
        if (tag === 'select') {
          VerificationEngine.setNativeSelectValue(snap.element as HTMLSelectElement, snap.originalValue);
        } else {
          VerificationEngine.setNativeInputValue(snap.element as HTMLInputElement, snap.originalValue);
        }
        restoredCount++;
      }
    }

    tx.status = 'ROLLED_BACK';
    return { restoredCount, status: 'ROLLED_BACK' };
  }

  public static getTransaction(transactionId: string): TransactionRecord | undefined {
    return this.activeTransactions.get(transactionId);
  }
}
