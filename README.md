# JVMScope

Look inside a running JVM without stopping it.

JVMScope is a desktop app that attaches to a Java process — on your machine or in a Kubernetes
pod — pulls its jar, decompiles it, and opens the source in an embedded VS Code
([code-server](https://github.com/coder/code-server)). Alongside the code you get form-driven
`watch`, `trace` and time-tunnel (record and replay past calls), so you can see arguments,
return values, exceptions and per-call timings against the source you are reading.

Instrumentation is provided by [Arthas](https://arthas.aliyun.com/), driven over the
[Arthas MCP Server](https://arthas.aliyun.com/en/doc/mcp-server.html) rather than its
interactive console, so results arrive as structured data and render as real tables and call
trees instead of terminal text.

## Status

**Phase 1 (local JVM) is implemented and verified end to end against a real Java server.**
Attach → fetch jar → explode → CFR decompile → launch code-server → connect MCP → run
watch/trace/tt all work, and the results render as tables and call trees in the UI.

Pod support (Phase 2, kubectl) and Tunnel Server support (Phase 3) are implemented in
`packages/core` (`kubectl-jps.ts`, `kubectl-attach.ts`, `port-forward.ts`, `tunnel-registry.ts`)
but have **not** been tested against a real cluster — no cluster was available here. The
Tunnel Server path in particular still needs the Spike D validation described below.

## Prerequisites

- Node.js 20+ and pnpm (`npm install -g pnpm`)
- A JDK on `PATH` (provides `java` and `jps`)
- **Windows only:** WSL2 with a Linux distro. code-server publishes **no native Windows build**
  (GitHub releases ship Linux/macOS assets only), so on Windows the app installs and runs
  code-server inside WSL2 and relies on WSL2's automatic localhost forwarding. `wsl --install`
  if you don't have it.
- `kubectl` on `PATH` for Phase 2/3 only

## Setup

```bash
pnpm install
```

```bash
pnpm run build
```

On first launch the app downloads `arthas-boot.jar`, `cfr.jar`, and code-server into
`~/.jvmscope/bin/` — nothing to place by hand.

## Run

```bash
pnpm start
```

For UI work with hot reload, run the renderer dev server and point the shell at it:

```bash
pnpm run dev:renderer
```

```bash
JVMSCOPE_RENDERER_URL=http://localhost:5173 pnpm run dev:main
```

## Try it against the bundled test server

`testapp/` is a dependency-free Java HTTP server with deliberately layered calls
(`OrderService.placeOrder` → `InventoryClient.checkStock` + `PricingEngine.computeTotal`) and a
background thread that keeps calling them, so `watch`/`trace` produce output immediately. One
in seven background calls passes `quantity=0` and throws, giving the exception paths something
real to catch.

```bash
pnpm run testapp:build
```

```bash
pnpm run testapp:run
```

Then run `pnpm start`, pick the `demo-server.jar` PID, and attach. When prompted for the jar
path, give it `testapp/dist/demo-server.jar`.

## Verify without the GUI

Full pipeline against a live JVM (the same `SessionManager` the app drives over IPC):

```bash
pnpm run spike:e2e -- <pid> testapp/dist/demo-server.jar
```

Unit tests (pure logic; no Electron, Arthas, or JVM needed):

```bash
pnpm test
```

Component rendering against payloads captured from a real Arthas server — open
`http://localhost:5199/harness.html`:

```bash
pnpm run harness
```

Confirm the Electron preload bridge reaches the renderer:

```bash
pnpm run verify:preload
```

## Architecture

```
packages/
  core/      @jvmscope/core   — orchestration, no Electron dependency, unit-testable
    discovery/    local + kubectl jps, tunnel-server agent registry
    attach/       local + in-pod Arthas bootstrap, kubectl port-forward bridge
    jar-pipeline/ retrieve -> explode -> CFR decompile, sha256-keyed cache
    mcp/          MCP client, tool catalog, command runner, result parser
    codeserver/   provisioning (native + WSL2) and per-session process lifecycle
    session/      the attach state machine tying it all together
  preload/   @jvmscope/preload — contextBridge IPC surface (CommonJS, see below)
  main/      @jvmscope/main    — Electron main process, IPC handlers, WebContentsView
  renderer/  @jvmscope/renderer — React UI
testapp/     dependency-free Java server used to exercise the whole thing
```

Renderer code imports from `@jvmscope/core/browser`, a deliberately narrow entry point
exposing only types and pure parsers. Importing the main entry from the renderer drags
`child_process`/`fs` into the browser bundle and breaks the build.

## Things that surprised us (verified against Arthas 4.3.4)

These cost real debugging time and are easy to get wrong from the docs alone:

- **There is no `--mcp-server-port` flag.** Arthas serves MCP on its regular HTTP port
  (`--http-port`, default 8563) at the `arthas.mcpEndpoint` path. The endpoint is
  `http://host:8563/mcp` — **not** the host root.
- **MCP is on by default in Arthas 4.3.4.** Its shipped `arthas.properties` already sets
  `arthas.mcpEndpoint=/mcp` and `arthas.mcpProtocol=STREAMABLE`.
- **A bare `GET /mcp` returns HTTP 400** ("text/event-stream required in Accept header").
  That is correct Streamable-HTTP behaviour and is what the readiness probe keys off.
- **MCP returns structured JSON, not ANSI terminal text.** An early design used xterm.js for
  output; that was wrong. Results are rendered as real tables and call trees instead.
- **Trace costs are nanoseconds** while watch/tt costs are milliseconds.
- **`tt` is action-based** — `action` is required (`record`/`list`/`info`/`replay`/`delete`),
  which is why Time Tunnel is its own panel rather than a plain schema form.
- **CFR cannot decompile a directory**, only a `.jar`/`.class`. A fat jar's `BOOT-INF/classes`
  is re-packed into a temp jar first. CFR also writes its `Processing <class>` progress lines
  to **stderr**, not stdout.
- **Electron sandboxed preloads must be CommonJS.** An ESM preload fails with "Cannot use
  import statement outside a module" and the bridge silently never reaches the renderer, so
  `packages/preload` intentionally omits `"type": "module"`.
- **Top-level `await` does not work in Electron's ESM main process** — use `app.whenReady().then(...)`.
- Arthas ships **Chinese tool descriptions**; they surface verbatim in the schema-driven forms.
- **Electron does not implement `window.prompt()`.** Asking for the jar path inline silently
  returned null, so attach could never start; it now uses a native `dialog.showOpenDialog`.
- **Under WSL, the workspace path must be translated for the `?folder=` URL too**, not just the
  CLI argument. code-server resolves that path inside its own (Linux) filesystem, so a raw
  Windows path produces "Unable to resolve resource C:%5CUsers%5C…" and an empty editor.
  Guarded by `test/wsl-path.test.ts`.
- **A zustand selector must not construct its own default.** `state.commandChunks[id] ?? []`
  allocates a new array on every read, and zustand compares results with `Object.is` — so it
  re-rendered forever (React error #185, "Maximum update depth exceeded"), which unmounted the
  whole tree and left a **blank window with no error displayed**. Select the stored value and
  apply the default outside the selector against a module-level constant. Guarded by
  `test/selector-stability.test.ts`; an `ErrorBoundary` now makes renderer crashes visible.

## Debugging the UI

Set `JVMSCOPE_LOG=<abs path>` to mirror renderer console output, preload errors and
session transitions into a file — Electron main-process stdout is not visible on Windows and
renderer errors never reach it at all.

The native jar-picker dialog is modal and cannot be dismissed programmatically, and the
contextBridge API is frozen so it cannot be stubbed from the page either. For automated runs
the main process honours `JVMSCOPE_JAR_OVERRIDE` — but only when test hooks are enabled:
`NODE_ENV` must be exactly `test` or `development` **and** the build must be unpackaged
(`areTestHooksEnabled`, `packages/core/src/config/test-hooks.ts`).

That check is an allowlist rather than `NODE_ENV !== "production"` on purpose: Electron does
not set `NODE_ENV`, so it is `undefined` in a packaged app and a denylist would leave the hook
enabled in the shipped build. Verify the gate with real runtime values via
`pnpm exec electron scripts/verify-test-hook-gate.mjs`.

`packages/main/scripts/drive-ui.mjs` boots the real app and drives it programmatically
(clicks Refresh/Attach, fills the Watch form, runs it) and dumps DOM state, so UI regressions
are reproducible without clicking:

```bash
JVMSCOPE_LOG=/tmp/drive.log PID=<pid> JAR=<abs jar> pnpm --filter @jvmscope/main exec electron scripts/drive-ui.mjs
```

## Known gaps

- Phase 2/3 (pod + Tunnel Server) are unverified against a real cluster.
- Tunneling MCP through the Arthas Tunnel Server may need work — see
  [alibaba/arthas#3119](https://github.com/alibaba/arthas/issues/3119). The fallback is to keep
  `kubectl port-forward` for the MCP channel.
- The jar path is entered by hand on attach; resolving it automatically from `jps -lv` is
  unreliable for fat jars and exploded WARs.
- `provisionCodeServer` has no macOS-Intel path (upstream ships only `macos-arm64`).
- code-server runs with `--auth none` bound to loopback only.
