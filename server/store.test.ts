import { describe, expect, it } from "vitest";

describe("pipeline stages", () => {
  it("keeps the terminal stage terminal", () => {
    const stages = ["opportunity", "brief", "draft", "scheduled", "published"];
    const next = (stage: string) => stages[Math.min(stages.indexOf(stage) + 1, stages.length - 1)];
    expect(next("opportunity")).toBe("brief");
    expect(next("published")).toBe("published");
  });
});
