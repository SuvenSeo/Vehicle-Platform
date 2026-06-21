import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Loader } from "@/components/Loader";

describe("Loader entry flow", () => {
  it("shows a compact AutoLens loading state", () => {
    render(<Loader />);

    expect(screen.getByText(/AutoLens/i)).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /Loading AutoLens LK/i })).toBeInTheDocument();
  });

  it("automatically enters the app after a short pause", () => {
    vi.useFakeTimers();
    const onEnter = vi.fn();

    render(<Loader onEnter={onEnter} />);
    expect(onEnter).toHaveBeenCalledTimes(0);

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(onEnter).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
