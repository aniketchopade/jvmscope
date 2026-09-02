import { describe, expect, it } from "vitest";
import { parseJpsOutput } from "../src/discovery/local-jps.js";

describe("parseJpsOutput", () => {
  it("parses pid + main class pairs and drops the Jps process itself", () => {
    const output = [
      "12345 com.example.Application",
      "67890 sun.tools.jps.Jps",
      "24680 /opt/app/app.jar",
    ].join("\n");

    const targets = parseJpsOutput(output, "local");

    expect(targets).toEqual([
      { pid: "12345", displayName: "com.example.Application", mode: "local" },
      { pid: "24680", displayName: "/opt/app/app.jar", mode: "local" },
    ]);
  });

  it("handles empty output", () => {
    expect(parseJpsOutput("", "local")).toEqual([]);
  });
});
