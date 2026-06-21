import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FeedbackWidget } from "@/components/FeedbackWidget";

vi.mock("@/services/api", () => ({
  sendFeedback: vi.fn(),
}));

describe("FeedbackWidget", () => {
  it("opens the feedback dialog from the fixed feedback action", async () => {
    render(
      <MemoryRouter initialEntries={["/?q=Toyota+Axio"]}>
        <FeedbackWidget />
      </MemoryRouter>,
    );

    const action = screen.getByRole("button", { name: /send feedback/i });
    expect(action).toHaveClass("bottom-20");

    fireEvent.click(action);

    expect(await screen.findByRole("dialog", { name: /send feedback/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /data issue/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/what should autolens fix or improve/i)).toBeInTheDocument();
  });
});
