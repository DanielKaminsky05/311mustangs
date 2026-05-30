import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApprovalQueue } from "./ApprovalQueue";
import { getPendingApprovals } from "@/app/lib/mock-data";

describe("ApprovalQueue", () => {
  it("renders an action row for each pending request", () => {
    const requests = getPendingApprovals();
    render(<ApprovalQueue requests={requests} />);
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(
      requests.length,
    );
  });

  it("marks a request approved and hides its action buttons", async () => {
    const user = userEvent.setup();
    const requests = getPendingApprovals();
    render(<ApprovalQueue requests={requests} />);

    const row = screen
      .getByText(requests[0].description)
      .closest("div.rounded-xl") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Approve" }));

    expect(within(row).getByText(/Approved/)).toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
  });

  it("supports overriding a request", async () => {
    const user = userEvent.setup();
    const requests = getPendingApprovals();
    render(<ApprovalQueue requests={requests} />);

    const row = screen
      .getByText(requests[0].description)
      .closest("div.rounded-xl") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Override" }));

    expect(within(row).getByText(/Overridden/)).toBeInTheDocument();
  });
});
