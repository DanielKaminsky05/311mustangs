import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionBadge } from "./DecisionBadge";
import { DECISION_META } from "@/app/lib/mock-data";

describe("DecisionBadge", () => {
  it("renders the human-readable label for each decision", () => {
    render(<DecisionBadge label="AUTO_SCHEDULE_PENDING_APPROVAL" />);
    expect(
      screen.getByText(DECISION_META.AUTO_SCHEDULE_PENDING_APPROVAL.label),
    ).toBeInTheDocument();
  });

  it("renders a duplicate badge", () => {
    render(<DecisionBadge label="DUPLICATE" />);
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
  });
});
