import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RouteTransition } from "@/components/RouteTransition";
import { pageEnter, pageExit, pageInitial } from "@/lib/motion";

describe("RouteTransition", () => {
  it("renders the active outlet without a CSS filter blur", () => {
    render(
      <MemoryRouter initialEntries={["/trends"]}>
        <Routes>
          <Route element={<RouteTransition />}>
            <Route path="/trends" element={<p>Trends page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Trends page")).toBeInTheDocument();
    expect("filter" in pageInitial).toBe(false);
    expect("filter" in pageEnter).toBe(false);
    expect("filter" in pageExit).toBe(false);
  });
});
