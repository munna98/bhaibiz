import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkerPhotoDialog } from "@/components/workers/WorkerPhotoDialog";
import { WorkerAvatar } from "@/components/workers/WorkerFields";

describe("WorkerPhotoDialog", () => {
  it("renders nothing when photoUrl is null or undefined", () => {
    const { container } = render(
      <WorkerPhotoDialog
        open={true}
        onOpenChange={vi.fn()}
        photoUrl={null}
        workerName="Rahul Kumar"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the dialog with full photo, worker name, and code when open", () => {
    render(
      <WorkerPhotoDialog
        open={true}
        onOpenChange={vi.fn()}
        photoUrl="https://example.com/photo.jpg"
        workerName="Rahul Kumar"
        workerCode="W-001"
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Rahul Kumar")).toBeInTheDocument();
    expect(screen.getByText(/W-001/)).toBeInTheDocument();
    const img = screen.getByAltText("Rahul Kumar") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe("https://example.com/photo.jpg");
  });

  it("triggers onOpenChange when closed", () => {
    const onOpenChange = vi.fn();
    render(
      <WorkerPhotoDialog
        open={true}
        onOpenChange={onOpenChange}
        photoUrl="https://example.com/photo.jpg"
        workerName="Rahul Kumar"
      />
    );

    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("WorkerAvatar", () => {
  it("renders initials avatar when url is not provided", () => {
    render(<WorkerAvatar name="Sunil Sharma" url={null} />);
    expect(screen.getByText("SS")).toBeInTheDocument();
  });

  it("renders img element when url is provided", () => {
    render(<WorkerAvatar name="Sunil Sharma" url="https://example.com/sunil.jpg" />);
    const img = screen.getByAltText("Sunil Sharma") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe("https://example.com/sunil.jpg");
  });
});
