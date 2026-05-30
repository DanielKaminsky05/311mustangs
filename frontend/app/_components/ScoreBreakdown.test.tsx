import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreBreakdown } from "./ScoreBreakdown";
import type { ScoreBreakdown as Scores } from "@/app/lib/mock-data";

const scores: Scores = {
  duplicate_score: 0.18,
  historical_similarity_score: 0.86,
  category_supported_score: 0.95,
  public_safety_score: 0.22,
  schedule_insertion_score: 0.71,
  confidence_score: 0.88,
};

describe("ScoreBreakdown", () => {
  it("renders every score label", () => {
    render(<ScoreBreakdown scores={scores} />);
    expect(screen.getByText("Confidence")).toBeInTheDocument();
    expect(screen.getByText("Public safety")).toBeInTheDocument();
    expect(screen.getByText("Historical similarity")).toBeInTheDocument();
  });

  it("formats values to two decimal places", () => {
    render(<ScoreBreakdown scores={scores} />);
    expect(screen.getByText("0.88")).toBeInTheDocument();
    expect(screen.getByText("0.22")).toBeInTheDocument();
  });
});
