import { access, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { join } from "node:path";
import { execa } from "execa";
import type { CodeServerBinary } from "./manager.js";
import { isWsl2Available, runInWsl, type WslOptions } from "./wsl.js";

const RELEASES_BASE = "https://github.com/coder/code-server/releases/download";

function platformArchive(version: string): { archiveName: string; binRelPath: string } {
  const platform = process.platform;
  const arch = process.arch === "arm64" ? "arm64" : "amd64";

  if (platform === "darwin") {
    // As of recent releases, GitHub only ships a macos-arm64 asset (no Intel build) — Intel
    // Mac users hit the same "no matching asset" problem Windows does; not handled here yet.
    return { archiveName: `code-server-${version}-macos-${arch}.tar.gz`, binRelPath: `code-server-${version}-macos-${arch}/bin/code-server` };
  }
  return { archiveName: `code-server-${version}-linux-${arch}.tar.gz`, binRelPath: `code-server-${version}-linux-${arch}/bin/code-server` };
}

/**
 * Native (Linux/macOS) first-run provisioning: downloads the platform/arch-specific
 * code-server release tarball from GitHub (there is no maintained npm-installable server
 * binary) into a cache dir, and extracts it.
 */
async function provisionCodeServerNative(cacheDir: string, version: string): Promise<CodeServerBinary> {
  const { archiveName, binRelPath } = platformArchive(version);
  const binPath = join(cacheDir, binRelPath);

  try {
    await access(binPath);
    return { binPath, runner: "native" };
  } catch {
    // not yet provisioned
  }

  await mkdir(cacheDir, { recursive: true });
  const archivePath = join(cacheDir, archiveName);
  const url = `${RELEASES_BASE}/v${version}/${archiveName}`;

  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download code-server from ${url}: ${res.status}`);
  }
  const out = createWriteStream(archivePath);
  await finished(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream).pipe(out));
  await execa("tar", ["-xzf", archivePath, "-C", cacheDir]);

  await access(binPath);
  return { binPath, runner: "native" };
}

/**
 * Windows provisioning: code-server publishes no native Windows build (GitHub releases only
 * ship Linux/macOS assets), so on win32 we install and run it inside WSL2 instead, via the
 * official install script. WSL2 forwards a service bound to localhost inside the distro to
 * the same port on the Windows-side localhost automatically, so the rest of the app (URL
 * construction, the embedded WebContentsView) is unaffected — only CodeServerManager.spawn
 * needs to know to invoke the binary through `wsl.exe` and translate the workspace path.
 */
async function provisionCodeServerWsl(opts?: WslOptions): Promise<CodeServerBinary> {
  if (!(await isWsl2Available(opts))) {
    throw new Error(
      "WSL2 is required to run code-server on Windows (code-server has no native Windows build). " +
        "Install it with `wsl --install` and re-launch JVMScope.",
    );
  }

  const existing = await runInWsl("command -v code-server || true", opts);
  if (existing) {
    return { binPath: existing, runner: "wsl", wslDistro: opts?.distro };
  }

  // --method=standalone installs to ~/.local (no root) instead of via the distro's package
  // manager, which would run `sudo dpkg -i ...` — that hangs forever waiting for a password
  // when spawned non-interactively from Electron, since there's no TTY to prompt on.
  await runInWsl("curl -fsSL https://code-server.dev/install.sh | sh -s -- --method=standalone", opts);
  const binPath = await runInWsl("command -v code-server", opts);
  if (!binPath) {
    throw new Error("code-server install script completed inside WSL2 but the binary could not be located on PATH");
  }
  return { binPath, runner: "wsl", wslDistro: opts?.distro };
}

/**
 * First-run provisioning entry point. Dispatches to the native downloader on Linux/macOS, or
 * the WSL2 installer on Windows. Callers should call this once at app startup / before the
 * first session attach, then reuse the returned CodeServerBinary for every subsequent session.
 */
export async function provisionCodeServer(cacheDir: string, version = "4.96.4", wslOpts?: WslOptions): Promise<CodeServerBinary> {
  if (process.platform === "win32") {
    return provisionCodeServerWsl(wslOpts);
  }
  return provisionCodeServerNative(cacheDir, version);
}
