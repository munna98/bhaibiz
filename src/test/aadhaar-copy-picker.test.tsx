import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AadhaarCopyPicker, formatFileSize } from "@/components/workers/AadhaarCopyPicker";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("formatFileSize", () => {
  it("formats bytes, kilobytes, and megabytes correctly", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});

describe("AadhaarCopyPicker (Images only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders upload dropzone when no file is selected", () => {
    const onChange = vi.fn();
    render(<AadhaarCopyPicker file={null} onChange={onChange} />);

    expect(screen.getByText("Upload Aadhaar copy")).toBeInTheDocument();
    expect(screen.getByText("Photo, up to 5 MB")).toBeInTheDocument();
    expect(screen.getByTestId("aadhaar-copy-dropzone")).toBeInTheDocument();
  });

  it("triggers file input click when dropzone is clicked", () => {
    const onChange = vi.fn();
    render(<AadhaarCopyPicker file={null} onChange={onChange} />);

    const fileInput = screen.getByTestId("aadhaar-copy-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    fireEvent.click(screen.getByTestId("aadhaar-copy-dropzone"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("renders image preview and details when an image file is provided", () => {
    const onChange = vi.fn();
    const imageFile = new File(["dummy image content"], "aadhaar-card.jpg", {
      type: "image/jpeg",
    });

    render(<AadhaarCopyPicker file={imageFile} onChange={onChange} />);

    expect(screen.getByTestId("aadhaar-copy-preview-card")).toBeInTheDocument();
    expect(screen.getByAltText("Aadhaar copy preview")).toBeInTheDocument();
    expect(screen.getByText("aadhaar-card.jpg")).toBeInTheDocument();
    expect(screen.getByText("Change")).toBeInTheDocument();
    expect(screen.getByText("Enlarge preview")).toBeInTheDocument();
  });

  it("calls onChange(null) when remove button is clicked", () => {
    const onChange = vi.fn();
    const imageFile = new File(["dummy content"], "aadhaar.png", {
      type: "image/png",
    });

    render(<AadhaarCopyPicker file={imageFile} onChange={onChange} />);

    const removeBtn = screen.getByTitle("Remove");
    fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("opens enlarged preview modal when enlarge button is clicked", () => {
    const onChange = vi.fn();
    const imageFile = new File(["dummy content"], "aadhaar.png", {
      type: "image/png",
    });

    render(<AadhaarCopyPicker file={imageFile} onChange={onChange} />);

    const enlargeBtn = screen.getByTitle("View full preview");
    fireEvent.click(enlargeBtn);

    const dialogTitles = screen.getAllByText("aadhaar.png");
    expect(dialogTitles.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects PDF files and non-image files with an error toast", () => {
    const onChange = vi.fn();
    render(<AadhaarCopyPicker file={null} onChange={onChange} />);

    const pdfFile = new File(["dummy pdf content"], "doc.pdf", {
      type: "application/pdf",
    });

    const fileInput = screen.getByTestId("aadhaar-copy-input");
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    expect(toast.error).toHaveBeenCalledWith("Upload a photo of the Aadhaar card.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects files larger than 5 MB with an error toast", () => {
    const onChange = vi.fn();
    render(<AadhaarCopyPicker file={null} onChange={onChange} />);

    const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], "large-photo.jpg", {
      type: "image/jpeg",
    });

    const fileInput = screen.getByTestId("aadhaar-copy-input");
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    expect(toast.error).toHaveBeenCalledWith("File is larger than 5 MB");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts a dropped valid image file", () => {
    const onChange = vi.fn();
    render(<AadhaarCopyPicker file={null} onChange={onChange} />);

    const dropzone = screen.getByTestId("aadhaar-copy-dropzone");
    const droppedFile = new File(["image data"], "card.jpeg", {
      type: "image/jpeg",
    });

    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [droppedFile],
      },
    });

    expect(onChange).toHaveBeenCalledWith(droppedFile);
  });
});
