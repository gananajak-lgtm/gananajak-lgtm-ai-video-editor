/**
 * Serialize async writes so a slow older snapshot cannot overwrite a newer one.
 * A failed write must not permanently block subsequent writes.
 */
export function createSerializedSaveQueue<T>(write: (value: T) => Promise<void>) {
  let tail: Promise<void> = Promise.resolve();
  return (value: T): Promise<void> => {
    const pending = tail.catch(() => undefined).then(() => write(value));
    tail = pending;
    return pending;
  };
}
