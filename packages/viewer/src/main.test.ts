import { describe, expect, it } from "vitest";
import { groupFiles } from "./main";

describe("viewer file grouping", () => {
  it("groups root-level files under Root", () => {
    expect(groupFiles([
      { path: "01-metric.agent.md", diagnostics: [] },
      { path: "nested/report.agent.md", diagnostics: [] }
    ])).toEqual([
      { folder: "Root", files: [{ path: "01-metric.agent.md", diagnostics: [] }] },
      { folder: "nested", files: [{ path: "nested/report.agent.md", diagnostics: [] }] }
    ]);
  });
});
