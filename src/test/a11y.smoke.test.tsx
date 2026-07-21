import "vitest-axe/extend-expect";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import * as axeMatchers from "vitest-axe/matchers";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";

declare module "vitest" {
  // Matches vitest's own `Assertion<T = any>` signature for declaration merging.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
}

expect.extend(axeMatchers);

describe("a11y smoke", () => {
  it("has no axe violations for core presentational components", async () => {
    const { container } = render(
      <main>
        <h1>Motormila Accessibility Smoke Test</h1>
        <BrandLogo showWordmark showTagline />
        <div>
          <Button type="button">Start valuation</Button>
          <Button type="button" variant="outline">
            Open market
          </Button>
        </div>
      </main>,
    );

    const results = await axe(container, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });
});
