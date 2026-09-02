/**
 * Arthas ships Chinese descriptions in its MCP tool schemas. Rather than surface those
 * verbatim, we map the well-known tools and parameters to English. Anything unmapped falls
 * back to no description at all (see `describeParam`) — an empty hint reads better than a
 * wall of text the user can't read.
 */

const TOOL_DESCRIPTIONS: Record<string, string> = {
  watch: "Observe a method's arguments, return value and thrown exceptions as it is called.",
  trace: "Trace the call path inside a method, with the time cost of each node.",
  tt: "Time tunnel — record each call of a method, then inspect or replay any captured call.",
  monitor: "Aggregate call counts, failure rate and average response time for a method.",
  stack: "Print the call path that reaches a given method.",
  jad: "Decompile a class already loaded in the JVM.",
  sc: "Search loaded classes (wildcards and regex supported).",
  sm: "Search methods of loaded classes.",
  thread: "Show thread information and stacks.",
  jvm: "Show JVM runtime information.",
  dashboard: "Live JVM/application dashboard.",
  ognl: "Evaluate an OGNL expression in the target JVM.",
  vmtool: "Query live instances, force GC, interrupt threads.",
  heapdump: "Write a heap dump.",
  memory: "Show JVM memory usage.",
  sysprop: "View or modify system properties.",
  sysenv: "View environment variables.",
  profiler: "Sample CPU/alloc/lock events and produce a flamegraph.",
  logger: "View or change logger levels.",
  redefine: "Reload a class's bytecode.",
  retransform: "Retransform a loaded class.",
  options: "View or change Arthas global options.",
  version: "Show the Arthas version running in the target JVM.",
};

const PARAM_LABELS: Record<string, string> = {
  classPattern: "Class pattern",
  methodPattern: "Method pattern",
  express: "Watch expression",
  condition: "Condition (OGNL)",
  action: "Action",
  index: "Index",
  numberOfExecutions: "Number of executions",
  timeout: "Timeout (seconds)",
  expandLevel: "Expand depth",
  maxMatchCount: "Max matched classes",
  sizeLimit: "Output size limit (bytes)",
  successOnly: "Only successful returns",
  exceptionOnly: "Only thrown exceptions",
  beforeMethod: "Observe before the call",
  regex: "Treat patterns as regex",
  searchExpression: "Search expression",
  skipJDKMethod: "Skip JDK methods",
  listenerId: "Listener id",
  verbose: "Verbose output",
  className: "Class name",
  methodName: "Method name",
  classLoaderClass: "ClassLoader class",
  depth: "Depth",
  count: "Count",
  interval: "Interval",
};

const PARAM_DESCRIPTIONS: Record<string, string> = {
  classPattern: "e.g. com.example.OrderService, or *Service with wildcards",
  methodPattern: "e.g. placeOrder, or * for all methods",
  express: "OGNL over the call, e.g. {params, returnObj, throwExp}",
  condition: "Only record calls matching this, e.g. params[0] < 0 or #cost > 100",
  action: "record, list, info, replay or delete",
  index: "Which captured call to act on, from the Time Tunnel table",
  numberOfExecutions: "Stop after this many matching calls",
  timeout: "Give up after this many seconds",
  expandLevel: "How deep to expand object properties (max 4)",
  maxMatchCount: "Guard against matching too many classes",
  sizeLimit: "Truncate output beyond this many bytes",
  successOnly: "Only observe calls that returned normally",
  exceptionOnly: "Only observe calls that threw",
  beforeMethod: "Observe on entry rather than on exit",
  regex: "Interpret the class/method patterns as regular expressions",
  searchExpression: "OGNL used by the search action",
  skipJDKMethod: "Exclude JDK internals from the trace tree",
};

/** Reasonable starting values so the common case is one click, not eight fields. */
export const PARAM_DEFAULTS: Record<string, Record<string, unknown>> = {
  watch: { express: "{params, returnObj}", numberOfExecutions: 5, timeout: 20 },
  trace: { numberOfExecutions: 3, timeout: 20 },
  tt: { numberOfExecutions: 5, timeout: 20 },
  monitor: { numberOfExecutions: 3, timeout: 20 },
  stack: { numberOfExecutions: 3, timeout: 20 },
};

/** Parameters worth showing first; the rest go behind "Advanced". */
export const PRIMARY_PARAMS = new Set([
  "classPattern",
  "methodPattern",
  "express",
  "condition",
  "numberOfExecutions",
  "index",
]);

const CJK = /[㐀-鿿豈-﫿＀-￯]/;

/** True if a string is (or contains) CJK text we don't want to show. */
export function isCjk(text: string | undefined): boolean {
  return !!text && CJK.test(text);
}

export function labelForParam(name: string): string {
  return PARAM_LABELS[name] ?? name;
}

/** English description, or undefined — never the upstream Chinese text. */
export function describeParam(name: string, upstream: string | undefined): string | undefined {
  if (PARAM_DESCRIPTIONS[name]) return PARAM_DESCRIPTIONS[name];
  return isCjk(upstream) ? undefined : upstream;
}

export function describeTool(name: string, upstream: string | undefined): string | undefined {
  if (TOOL_DESCRIPTIONS[name]) return TOOL_DESCRIPTIONS[name];
  return isCjk(upstream) ? undefined : upstream;
}
