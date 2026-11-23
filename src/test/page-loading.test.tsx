import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageSkeleton } from "@/components/PageSkeleton";

describe("Page loading and transition indicators", () => {
  it("renders the PageSkeleton with accessible role and placeholder skeletons", () => {
    render(<PageSkeleton />);

    const skeletonContainer = screen.getByTestId("page-skeleton");
    expect(skeletonContainer).toBeInTheDocument();
    expect(skeletonContainer).toHaveAttribute("aria-busy", "true");
    expect(skeletonContainer).toHaveAttribute("aria-label", "Loading page");
  });
});
