import type { ReactNode } from "react";
import { MemoryRouter, type MemoryRouterProps } from "react-router-dom";

const ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

type TestRouterProps = MemoryRouterProps & {
  children: ReactNode;
};

export function TestRouter({ children, future, ...props }: TestRouterProps) {
  return (
    <MemoryRouter future={{ ...ROUTER_FUTURE_FLAGS, ...future }} {...props}>
      {children}
    </MemoryRouter>
  );
}
