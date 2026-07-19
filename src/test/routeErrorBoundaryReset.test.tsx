import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

function Boom(): React.ReactElement {
  throw new Error("Maximum call stack size exceeded");
}

function Home() {
  return <p>Home ok</p>;
}

function Layout() {
  return (
    <RouteErrorBoundary>
      <Outlet />
    </RouteErrorBoundary>
  );
}

describe("RouteErrorBoundary", () => {
  it("clears the error UI when the route changes", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/boom"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/boom" element={<Boom />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/This page failed to load/i)).toBeInTheDocument();
    expect(screen.getByText(/Maximum call stack size exceeded/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Back home/i }));
    expect(screen.getByText("Home ok")).toBeInTheDocument();
    expect(screen.queryByText(/This page failed to load/i)).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
