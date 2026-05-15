import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AgentMarkdownRenderer, type StaticArtifact } from "./index";
import type { AgentMarkdownDocument } from "@agent-md/schema";

vi.mock("recharts", async () => {
  const React = await import("react");
  const Component = (name: string) => ({ children, dataKey, nameKey }: { children?: React.ReactNode; dataKey?: string; nameKey?: string }) => React.createElement("div", { "data-recharts": name, "data-key": dataKey, "data-name-key": nameKey }, children);
  return {
    ResponsiveContainer: Component("ResponsiveContainer"),
    LineChart: Component("LineChart"),
    Line: Component("Line"),
    BarChart: Component("BarChart"),
    Bar: Component("Bar"),
    AreaChart: Component("AreaChart"),
    Area: Component("Area"),
    ScatterChart: Component("ScatterChart"),
    Scatter: Component("Scatter"),
    PieChart: Component("PieChart"),
    Pie: Component("Pie"),
    Cell: Component("Cell"),
    XAxis: Component("XAxis"),
    YAxis: Component("YAxis"),
    Tooltip: Component("Tooltip"),
    Legend: Component("Legend")
  };
});

function render(nodes: AgentMarkdownDocument["nodes"], dataSources: AgentMarkdownDocument["dataSources"] = {}, staticArtifacts?: Record<string, StaticArtifact>) {
  const document: AgentMarkdownDocument = { format: "agent-md", version: "0.1", sourcePath: "/tmp/test.agent.md", nodes, dataSources, diagnostics: [] };
  return renderToStaticMarkup(<AgentMarkdownRenderer document={document} staticArtifacts={staticArtifacts} />);
}

describe("AgentMarkdownRenderer primitives", () => {
  it("renders inferred callout bodies only once", () => {
    const html = render([{ type: "callout", calloutType: "warning", title: "Heads up", body: "Render me once", children: [{ type: "markdown", value: "Render me once" }] }]);
    expect(html.match(/Render me once/g)).toHaveLength(1);
  });

  it("honors query sort direction", () => {
    const html = render([{ type: "query", data: "sales", select: ["month", "revenue"], sort: { by: "revenue", direction: "desc" }, view: "table" }], {
      sales: { id: "sales", origin: "inline", format: "csv", rows: [{ month: "Jan", revenue: 1 }, { month: "Mar", revenue: 3 }, { month: "Feb", revenue: 2 }], diagnostics: [] }
    });
    expect(html.indexOf("Mar")).toBeLessThan(html.indexOf("Feb"));
    expect(html.indexOf("Feb")).toBeLessThan(html.indexOf("Jan"));
  });

  it("uses x and y as pie chart name and value keys", () => {
    const html = render([{ type: "chart", chartType: "pie", title: "Platform mix", data: "platforms", x: "platform_usage", y: "count" }], {
      platforms: { id: "platforms", origin: "inline", format: "csv", rows: [{ platform_usage: "TikTok", count: 10 }, { platform_usage: "Instagram", count: 8 }], diagnostics: [] }
    });

    expect(html).toContain("data-key=\"count\"");
    expect(html).toContain("data-name-key=\"platform_usage\"");
  });

  it("renders form controls according to schema", () => {
    const html = render([{
      type: "form",
      title: "Scenario",
      submitLabel: "Save locally",
      fields: [
        { name: "name", fieldType: "text", default: "Base" },
        { name: "segment", fieldType: "select", options: ["SMB", "Enterprise"], default: "Enterprise" },
        { name: "risk", fieldType: "checkbox", default: true }
      ]
    }]);
    expect(html).toContain("<select");
    expect(html).toContain("<option value=\"Enterprise\" selected=\"\">Enterprise</option>");
    expect(html).toContain("type=\"checkbox\"");
    expect(html).toContain("checked=\"\"");
    expect(html).toContain("Save locally");
  });

  it("renders timeline details and tab variant classes", () => {
    const html = render([
      { type: "timeline", layout: "horizontal", events: [{ date: "2026-01-01", title: "Start", description: "Details", group: "Setup" }] },
      { type: "tabs", variant: "pill", tabs: [{ label: "One", children: [{ type: "markdown", value: "Body" }] }] }
    ]);
    expect(html).toContain("agent-md-timeline-horizontal");
    expect(html).toContain("Setup");
    expect(html).toContain("Details");
    expect(html).toContain("agent-md-tabs-pill");
  });

  it("renders static artifact-backed embeds without fetching", () => {
    const html = render([{ type: "embed", title: "Summary", src: "artifacts/summary.md", mode: "preview" }], {}, {
      "artifacts/summary.md": { kind: "text", mime: "text/plain", content: "# Embedded Summary\n\nLocal artifact body." }
    });
    expect(html).toContain("Embedded Summary");
    expect(html).toContain("Local artifact body");
    expect(html).not.toContain("Unable to load artifact");
  });
});
