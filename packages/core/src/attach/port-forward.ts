import { execa, type ResultPromise } from "execa";
import type { KubectlOptions } from "../kubectl/exec.js";
import type { PodRef } from "../session/types.js";

/**
 * Phase 2 bridge: manages a `kubectl port-forward` subprocess exposing a pod port on
 * 127.0.0.1, restarting it if it drops. Not used once Phase 3's Tunnel Server is wired up.
 */
export class PortForwardBridge {
  private child?: ResultPromise;
  private stopped = false;

  constructor(
    private readonly ref: PodRef,
    private readonly localPort: number,
    private readonly remotePort: number,
    private readonly opts?: KubectlOptions,
  ) {}

  async start(): Promise<void> {
    this.stopped = false;
    this.spawn();
  }

  private spawn(): void {
    const args = [
      ...(this.opts?.context ? ["--context", this.opts.context] : []),
      "port-forward",
      "-n",
      this.ref.namespace,
      `pod/${this.ref.pod}`,
      `${this.localPort}:${this.remotePort}`,
    ];
    this.child = execa("kubectl", args, { reject: false });
    this.child.then(() => {
      if (!this.stopped) {
        // dropped unexpectedly — restart
        this.spawn();
      }
    });
  }

  stop(): void {
    this.stopped = true;
    this.child?.kill();
  }
}
