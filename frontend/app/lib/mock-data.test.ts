import { describe, it, expect } from "vitest";
import {
  DECISION_META,
  SCORE_LABELS,
  SERVICE_REQUESTS,
  formatBytes,
  formatTime,
  getPendingApprovals,
  getRequest,
  type ScoreBreakdown,
} from "./mock-data";

describe("formatBytes", () => {
  it("formats bytes, KB, and MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(2_418_322)).toBe("2.3 MB");
  });
});

describe("formatTime", () => {
  it("renders a stable human-readable timestamp", () => {
    // en-CA short month/day + 24h-ish time; assert it contains the day.
    const out = formatTime("2026-01-15T19:42:00");
    expect(out).toMatch(/15/);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("getRequest", () => {
  it("returns a request by id", () => {
    expect(getRequest("SR-2026-004411")?.id).toBe("SR-2026-004411");
  });

  it("returns undefined for an unknown id", () => {
    expect(getRequest("nope")).toBeUndefined();
  });
});

describe("getPendingApprovals", () => {
  it("only returns items that need a human (review or pending-approval)", () => {
    const pending = getPendingApprovals();
    expect(pending.length).toBeGreaterThan(0);
    for (const r of pending) {
      expect(["HUMAN_REVIEW", "AUTO_SCHEDULE_PENDING_APPROVAL"]).toContain(
        r.decision.label,
      );
    }
  });

  it("excludes auto-scheduled and duplicate items", () => {
    const ids = getPendingApprovals().map((r) => r.id);
    expect(ids).not.toContain("SR-2026-004402"); // AUTO_SCHEDULE
    expect(ids).not.toContain("SR-2026-004417"); // DUPLICATE
  });
});

describe("mock data integrity", () => {
  const scoreKeys = Object.keys(SCORE_LABELS) as (keyof ScoreBreakdown)[];

  it("has unique request ids", () => {
    const ids = SERVICE_REQUESTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every decision label has display metadata", () => {
    for (const r of SERVICE_REQUESTS) {
      expect(DECISION_META[r.decision.label]).toBeDefined();
    }
  });

  it("all scores are within the 0–1 range", () => {
    for (const r of SERVICE_REQUESTS) {
      for (const key of scoreKeys) {
        const v = r.decision.scores[key];
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("a duplicate decision cites at least one nearest record with high similarity", () => {
    const dup = SERVICE_REQUESTS.find((r) => r.decision.label === "DUPLICATE");
    expect(dup).toBeDefined();
    expect(dup!.decision.nearest[0].similarity).toBeGreaterThan(0.9);
  });

  it("a pending-approval decision has a rejected then accepted schedule candidate", () => {
    const pa = SERVICE_REQUESTS.find(
      (r) => r.decision.label === "AUTO_SCHEDULE_PENDING_APPROVAL",
    );
    expect(pa?.decision.schedule).toBeDefined();
    const statuses = pa!.decision.schedule!.map((c) => c.status);
    expect(statuses).toContain("rejected");
    expect(statuses).toContain("accepted");
  });
});
