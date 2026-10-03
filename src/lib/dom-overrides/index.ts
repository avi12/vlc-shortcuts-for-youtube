interface OverrideRecord<T> {
  original: T;
  applied: T;
}

export interface OverrideSlot<T> {
  records: WeakMap<object, OverrideRecord<T>>;
  target: object;
  read: () => T;
  write: (value: T) => void;
}

export function createOverrideRecords<T>() {
  return new WeakMap<object, OverrideRecord<T>>();
}

// The record outlives a restore so YouTube writing back a value it read from us still gets restored
export function applyOverride<T>({ slot, transform }: {
  slot: OverrideSlot<T>;
  transform: (original: T) => T;
}) {
  const current = slot.read();
  const isAlreadyApplied = slot.records.get(slot.target)?.applied === current;
  if (isAlreadyApplied) {
    return;
  }

  const applied = transform(current);
  slot.records.set(slot.target, {
    original: current,
    applied
  });

  if (applied === current) {
    return;
  }

  slot.write(applied);
}

export function restoreOverride<T>(slot: OverrideSlot<T>) {
  const record = slot.records.get(slot.target);
  if (!record) {
    return;
  }

  const isShowingOverride = record.applied !== record.original && slot.read() === record.applied;
  if (!isShowingOverride) {
    return;
  }

  slot.write(record.original);
}
