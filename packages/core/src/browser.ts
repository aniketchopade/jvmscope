/**
 * Browser-safe subset of the core package, for the Electron renderer.
 *
 * The main entry point (`index.ts`) pulls in child_process/fs/net via the discovery, attach,
 * jar-pipeline and code-server modules — importing it from renderer code drags Node built-ins
 * into the browser bundle and breaks the build. This entry deliberately re-exports only the
 * pure, dependency-free modules: the shared domain types and the MCP result parsers.
 *
 * Renderer code must import from "@jvmscope/core/browser", never "@jvmscope/core".
 */
export * from "./session/types.js";
export * from "./mcp/result-parser.js";
