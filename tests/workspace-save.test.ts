import { afterEach, describe, expect, it, vi } from "vitest";
import { workspaceSaveQueue } from "../shared/workspace-save";
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
afterEach(() => vi.useRealTimers());
describe("serialized workspace persistence", () => {
  it("saves a newer edit after the in-flight response using its acknowledged revision", async () => {
    vi.useFakeTimers();
    const first = deferred<{ revision: number }>();
    const send = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue({ revision: 9 });
    const queue = workspaceSaveQueue({
      initial: "initial",
      revision: 7,
      send,
      onError: vi.fn(),
    });
    queue.enqueue("first");
    await vi.advanceTimersByTimeAsync(450);
    queue.enqueue("second");
    await vi.advanceTimersByTimeAsync(450);
    expect(send).toHaveBeenCalledTimes(1);
    first.resolve({ revision: 8 });
    await Promise.resolve();
    await Promise.resolve();
    expect(send).toHaveBeenNthCalledWith(2, "second", 8);
    expect(queue.state.revision).toBe(9);
    queue.dispose();
  });
  it("coalesces queued edits without replacing the in-flight payload", async () => {
    vi.useFakeTimers();
    const first = deferred<{ revision: number }>();
    const send = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue({ revision: 3 });
    const queue = workspaceSaveQueue({
      initial: "initial",
      revision: 1,
      send,
      onError: vi.fn(),
    });
    queue.enqueue("first");
    await vi.advanceTimersByTimeAsync(450);
    queue.enqueue("second");
    queue.enqueue("latest");
    await vi.advanceTimersByTimeAsync(450);
    first.resolve({ revision: 2 });
    await Promise.resolve();
    await Promise.resolve();
    expect(send.mock.calls).toEqual([
      ["first", 1],
      ["latest", 2],
    ]);
    queue.dispose();
  });
  it("retains the latest edit after conflict and never blindly retries another tab's revision", async () => {
    vi.useFakeTimers();
    const first = deferred<{ revision: number }>(),
      error = vi.fn();
    const send = vi.fn().mockReturnValue(first.promise),
      queue = workspaceSaveQueue({
        initial: "initial",
        revision: 1,
        send,
        onError: error,
      });
    queue.enqueue("first");
    await vi.advanceTimersByTimeAsync(450);
    queue.enqueue("latest");
    first.reject(new Error("revision conflict"));
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.state).toMatchObject({
      blocked: true,
      pending: "latest",
      revision: 1,
    });
    expect(error).toHaveBeenCalledOnce();
    queue.dispose();
  });
  it("does not save unchanged load state and cancels an old connection's queued callbacks", async () => {
    vi.useFakeTimers();
    const send = vi.fn(),
      queue = workspaceSaveQueue({
        initial: "same",
        revision: 1,
        send,
        onError: vi.fn(),
      });
    queue.enqueue("same");
    await vi.advanceTimersByTimeAsync(450);
    expect(send).not.toHaveBeenCalled();
    queue.enqueue("old");
    queue.dispose();
    await vi.advanceTimersByTimeAsync(450);
    expect(send).not.toHaveBeenCalled();
  });
});
