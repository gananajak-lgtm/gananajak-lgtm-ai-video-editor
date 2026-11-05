/** Serialize writes in invocation order; failed writes do not block later saves. */
export function createSerializedSaveQueue<T>(write: (value: T) => Promise<void>) {
  let tail: Promise<void> = Promise.resolve();
  return (value: T): Promise<void> => {
    const pending = tail.catch(() => undefined).then(() => write(value));
    tail = pending;
    return pending;
  };
}
