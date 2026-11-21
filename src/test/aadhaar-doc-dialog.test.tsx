import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AadhaarDocDialog } from "@/components/workers/AadhaarDocDialog";

describe("AadhaarDocDialog", () => {
  it("renders nothing when url is null or undefined", () => {
    const { container } = render(
      <AadhaarDocDialog
        open={true}
        onOpenChange={vi.fn()}
        url={null}
        workerName="Rahul Kumar"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders image preview and download button when open with an image", () => {
    render(
      <AadhaarDocDialog
        open={true}
        onOpenChange={vi.fn()}
        url="https://example.com/aadhaar-front.jpg"
        fileName="aadhaar-front.jpg"
        uploadedAt="2026-11-20T10:00:00Z"
        workerName="Rahul Kumar"
        workerCode="W-001"
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("aadhaar-front.jpg")).toBeInTheDocument();
    expect(screen.getByText(/W-001/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download photo/i })).toBeInTheDocument();

    const img = screen.getByAltText("aadhaar-front.jpg") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe("https://example.com/aadhaar-front.jpg");
  });

  it("renders iframe when viewing a PDF document", () => {
    render(
      <AadhaarDocDialog
        open={true}
        onOpenChange={vi.fn()}
        url="https://example.com/aadhaar.pdf"
        fileName="aadhaar.pdf"
        workerName="Rahul Kumar"
        workerCode="W-001"
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const iframe = screen.getByTitle("aadhaar.pdf") as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.src).toBe("https://example.com/aadhaar.pdf");
  });

  it("triggers download when download button is clicked", async () => {
    const originalFetch = globalThis.fetch;
    const blobMock = new Blob(["dummy content"], { type: "image/jpeg" });
    globalThis.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(blobMock),
    });
    window.URL.createObjectURL = vi.fn().mockReturnValue("blob:dummy-aadhaar-url");
    window.URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <AadhaarDocDialog
        open={true}
        onOpenChange={vi.fn()}
        url="https://example.com/aadhaar-copy.jpg"
        fileName="aadhaar-copy.jpg"
        workerName="Rahul Kumar"
        workerCode="W-001"
      />
    );

    const downloadBtn = screen.getByRole("button", { name: /download photo/i });
    fireEvent.click(downloadBtn);

    expect(globalThis.fetch).toHaveBeenCalledWith("https://example.com/aadhaar-copy.jpg");
    await vi.waitFor(() => expect(clickSpy).toHaveBeenCalled());

    clickSpy.mockRestore();
    globalThis.fetch = originalFetch;
  });

  it("calls onOpenChange when closed", () => {
    const onOpenChange = vi.fn();
    render(
      <AadhaarDocDialog
        open={true}
        onOpenChange={onOpenChange}
        url="https://example.com/aadhaar.jpg"
        fileName="aadhaar.jpg"
        workerName="Rahul Kumar"
      />
    );

    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
