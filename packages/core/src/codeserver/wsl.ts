import { execa } from "execa";

/**
 * Converts a Windows path (e.g. C:\Users\me\.jvmscope\sessions\1\src) to its WSL2
 * mount-point equivalent (/mnt/c/Users/me/.jvmscope/sessions/1/src) so a workspace
 * directory created by the Windows-side app can be opened by code-server running in WSL2.
 */
export function windowsToWslPath(winPath: string): string {
  const match = /^([A-Za-z]):\\(.*)$/.exec(winPath);
  if (!match) {
    throw new Error(`Not an absolute Windows path: ${winPath}`);
  }
  const [, drive, rest] = match;
  return `/mnt/${drive.toLowerCase()}/${rest.replace(/\\/g, "/")}`;
}

export interface WslOptions {
  distro?: string;
}

function distroArgs(opts?: WslOptions): string[] {
  return opts?.distro ? ["-d", opts.distro] : [];
}

export async function isWsl2Available(opts?: WslOptions): Promise<boolean> {
  try {
    await execa("wsl.exe", [...distroArgs(opts), "--", "true"]);
    return true;
  } catch {
    return false;
  }
}

/** Runs a bash command line inside WSL2 and returns trimmed stdout. */
export async function runInWsl(command: string, opts?: WslOptions): Promise<string> {
  const { stdout } = await execa("wsl.exe", [...distroArgs(opts), "--", "bash", "-lc", command]);
  return stdout.trim();
}
