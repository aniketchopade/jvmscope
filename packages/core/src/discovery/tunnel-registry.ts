import type { DiscoveredTarget } from "../session/types.js";

/**
 * Phase 3: lists Java processes whose Arthas agents are already registered with the Tunnel
 * Server (agents bootstrapped with --tunnel-server, e.g. via KubectlAttachService). This is
 * a stub until Phase 0 Spike D confirms the Tunnel Server's agent-listing endpoint shape.
 */
export class TunnelRegistryDiscovery {
  constructor(private readonly clientHttpUrl: string) {}

  async listTargets(): Promise<DiscoveredTarget[]> {
    const res = await fetch(`${this.clientHttpUrl}/api/agents`);
    if (!res.ok) throw new Error(`Tunnel Server agent listing failed: ${res.status}`);
    const agents = (await res.json()) as { agentId: string; appName: string; pid?: string }[];
    return agents.map((a) => ({
      pid: a.pid ?? a.agentId,
      displayName: a.appName,
      mode: "pod-tunnel" as const,
      agentId: a.agentId,
    }));
  }
}
