/** Serialize revisioned saves. A rejected save retains the latest edit for explicit recovery. */
export function workspaceSaveQueue<T>(options: {
  initial: T;
  revision: number;
  send: (value: T, revision: number) => Promise<{ revision: number }>;
  onError: (error: unknown) => void;
  delay?: number;
}) {
  let revision = options.revision;
  let acknowledged = JSON.stringify(options.initial);
  let pending: { value: T; json: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false,
    blocked = false,
    disposed = false;
  async function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (disposed || blocked || inFlight || !pending) return;
    const current = pending;
    pending = null;
    if (current.json === acknowledged) return;
    inFlight = true;
    try {
      const result = await options.send(current.value, revision);
      revision = result.revision;
      acknowledged = current.json;
    } catch (error) {
      pending ||= current;
      blocked = true;
      if (!disposed) options.onError(error);
    } finally {
      inFlight = false;
      if (!disposed && !blocked && pending && !timer) void flush();
    }
  }
  return {
    enqueue(value: T) {
      if (disposed) return;
      pending = { value, json: JSON.stringify(value) };
      if (timer) clearTimeout(timer);
      if (!blocked)
        timer = setTimeout(() => void flush(), options.delay ?? 450);
    },
    flush,
    get state() {
      return { revision, inFlight, blocked, pending: pending?.value };
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
