import type { Snapshot } from "./snapshot.js";

/** Stores explicit edits; callers clear history when the simulation changes. */
export class EditHistory {
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];

  constructor(private readonly limit = 8) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new RangeError("Edit history limit must be an integer from 1 to 20.");
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  remember(snapshot: Snapshot): void {
    this.past.push(structuredClone(snapshot));
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
  }

  undo(current: Snapshot): Snapshot | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(structuredClone(current));
    return previous;
  }

  redo(current: Snapshot): Snapshot | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(structuredClone(current));
    return next;
  }

  clear(): void {
    this.past.length = 0;
    this.future.length = 0;
  }
}
