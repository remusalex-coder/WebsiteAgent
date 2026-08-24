/**
 * The job ledger — the sole writer of the three lifecycle counters
 * (`retry` / `rebuild` / `reconcept`, Freeze F-04) and, in the full factory,
 * of state / decision / budget. Hermes reads the counters through this module;
 * nobody else writes them.
 *
 * See ARCHITECTURE_FREEZE.md §F-02, §F-04, tasks P1-2 / P1-4.
 */

export interface Counter<T = number> {
  value: T;
  initialValue: T;
  max?: T;
  min?: T;
}

export class Ledger {
  private retryCount: Counter<number>;
  private rebuildCount: Counter<number>;
  private reconceptCount: Counter<number>;

  constructor(
    retryCount: number = 0,
    rebuildCount: number = 0,
    reconceptCount: number = 0
  ) {
    this.retryCount = { value: retryCount, initialValue: retryCount };
    this.rebuildCount = { value: rebuildCount, initialValue: rebuildCount };
    this.reconceptCount = { value: reconceptCount, initialValue: reconceptCount };
  }

  incrementRetry(): void {
    if (this.retryCount.max && this.retryCount.value >= this.retryCount.max) {
      throw new Error(`Retry count exceeded: ${this.retryCount.max}`);
    }
    this.retryCount.value++;
  }

  decrementRetry(): void {
    if (this.retryCount.value <= 0) {
      throw new Error("Cannot decrement retry count below zero");
    }
    this.retryCount.value--;
  }

  incrementRebuild(): void {
    if (this.rebuildCount.max && this.rebuildCount.value >= this.rebuildCount.max) {
      throw new Error(`Rebuild count exceeded: ${this.rebuildCount.max}`);
    }
    this.rebuildCount.value++;
  }

  decrementRebuild(): void {
    if (this.rebuildCount.value <= 0) {
      throw new Error("Cannot decrement rebuild count below zero");
    }
    this.rebuildCount.value--;
  }

  incrementReconcept(): void {
    if (this.reconceptCount.max && this.reconceptCount.value >= this.reconceptCount.max) {
      throw new Error(`Reconcept count exceeded: ${this.reconceptCount.max}`);
    }
    this.reconceptCount.value++;
  }

  decrementReconcept(): void {
    if (this.reconceptCount.value <= 0) {
      throw new Error("Cannot decrement reconcept count below zero");
    }
    this.reconceptCount.value--;
  }

  resetAll(): void {
    this.retryCount.value = this.retryCount.initialValue;
    this.rebuildCount.value = this.rebuildCount.initialValue;
    this.reconceptCount.value = this.reconceptCount.initialValue;
  }

  getRetryCount(): number {
    return this.retryCount.value;
  }

  getRebuildCount(): number {
    return this.rebuildCount.value;
  }

  getReconceptCount(): number {
    return this.reconceptCount.value;
  }

  serialize(): Record<string, number> {
    return {
      retryCount: this.retryCount.value,
      rebuildCount: this.rebuildCount.value,
      reconceptCount: this.reconceptCount.value,
    };
  }

  static deserialize(data: Record<string, number>): Ledger {
    return new Ledger(
      data.retryCount ?? 0,
      data.rebuildCount ?? 0,
      data.reconceptCount ?? 0
    );
  }

  onTransitionFailure(): void {
    this.incrementRetry();
  }

  onSuccessfulRetry(): void {
    this.incrementRebuild();
  }

  onRebuildOrConceptAction(): void {
    this.incrementReconcept();
  }
}