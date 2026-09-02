import { describe, expect, it } from "vitest";
import { windowsToWslPath } from "../src/codeserver/wsl.js";

describe("windowsToWslPath", () => {
  it("maps a Windows path to its WSL mount point", () => {
    expect(windowsToWslPath("C:\\Users\\anike\\.jvmscope\\sessions\\abc\\src")).toBe(
      "/mnt/c/Users/anike/.jvmscope/sessions/abc/src",
    );
  });

  it("lower-cases the drive letter", () => {
    expect(windowsToWslPath("D:\\work\\app")).toBe("/mnt/d/work/app");
  });

  it("rejects a path that is not an absolute Windows path", () => {
    expect(() => windowsToWslPath("/already/posix")).toThrow(/not an absolute windows path/i);
  });
});

/**
 * Regression guard: code-server resolves the workspace inside its OWN filesystem. Under WSL
 * the CLI argument was translated to /mnt/... but the ?folder= URL kept the raw Windows path,
 * so code-server failed with "Unable to resolve resource C:%5CUsers%5C...". Both must use the
 * translated path.
 */
describe("code-server workspace URL", () => {
  const buildUrl = (port: number, workspaceForServer: string) =>
    `http://127.0.0.1:${port}/?folder=${encodeURIComponent(workspaceForServer)}`;

  it("encodes the WSL path, never a Windows path, when running under WSL", () => {
    const winPath = "C:\\Users\\anike\\.jvmscope\\sessions\\abc\\src";
    const url = buildUrl(8590, windowsToWslPath(winPath));

    expect(url).toBe("http://127.0.0.1:8590/?folder=%2Fmnt%2Fc%2FUsers%2Fanike%2F.jvmscope%2Fsessions%2Fabc%2Fsrc");
    // %5C is an encoded backslash — its presence means a Windows path leaked into the URL.
    expect(url).not.toContain("%5C");
    expect(url).not.toContain("C%3A");
  });

  it("passes a native path through unchanged on Linux/macOS", () => {
    const url = buildUrl(8590, "/home/user/.jvmscope/sessions/abc/src");
    expect(decodeURIComponent(url)).toContain("/home/user/.jvmscope/sessions/abc/src");
  });
});
