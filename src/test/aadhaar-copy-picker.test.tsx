import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AadhaarCopyPicker,
  formatFileSize,
  type AadhaarFiles,
} from "@/components/workers/AadhaarCopyPicker";
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

describe("AadhaarCopyPicker (Front and Back)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both front and back upload dropzones when empty", () => {
    const onChange = vi.fn();
    render(<AadhaarCopyPicker value={{ front: null, back: null }} onChange={onChange} />);

    expect(screen.getByText("Front side")).toBeInTheDocument();
    expect(screen.getByText("Back side")).toBeInTheDocument();
    expect(screen.getByText("Upload front side")).toBeInTheDocument();
    expect(screen.getByText("Upload back side")).toBeInTheDocument();
    expect(screen.getByTestId("aadhaar-front-dropzone")).toBeInTheDocument();
    expect(screen.getByTestId("aadhaar-back-dropzone")).toBeInTheDocument();
  });

  it("triggers file input click when dropzone is clicked", () => {
    const onChange = vi.fn();
    render(<AadhaarCopyPicker value={{ front: null, back: null }} onChange={onChange} />);

    const frontInput = screen.getByTestId("aadhaar-front-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(frontInput, "click");

    fireEvent.click(screen.getByTestId("aadhaar-front-dropzone"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("renders image preview and details when front image is provided", () => {
    const onChange = vi.fn();
    const frontFile = new File(["dummy front"], "aadhaar-front.jpg", {
      type: "image/jpeg",
    });

    render(<AadhaarCopyPicker value={{ front: frontFile, back: null }} onChange={onChange} />);

    expect(screen.getByTestId("aadhaar-front-preview-card")).toBeInTheDocument();
    expect(screen.getByAltText("Aadhaar front preview")).toBeInTheDocument();
    expect(screen.getByText("aadhaar-front.jpg")).toBeInTheDocument();
    // Back side should still show upload dropzone
    expect(screen.getByTestId("aadhaar-back-dropzone")).toBeInTheDocument();
  });

  it("renders both front and back preview cards when both are provided", () => {
    const onChange = vi.fn();
    const frontFile = new File(["dummy front"], "aadhaar-front.jpg", { type: "image/jpeg" });
    const backFile = new File(["dummy back"], "aadhaar-back.jpg", { type: "image/jpeg" });

    render(<AadhaarCopyPicker value={{ front: frontFile, back: backFile }} onChange={onChange} />);

    expect(screen.getByTestId("aadhaar-front-preview-card")).toBeInTheDocument();
    expect(screen.getByTestId("aadhaar-back-preview-card")).toBeInTheDocument();
    expect(screen.getByText("aadhaar-front.jpg")).toBeInTheDocument();
    expect(screen.getByText("aadhaar-back.jpg")).toBeInTheDocument();
  });

  it("calls onChange with updated files when remove button is clicked", () => {
    const onChange = vi.fn();
    const frontFile = new File(["dummy front"], "aadhaar-front.jpg", { type: "image/jpeg" });
    const backFile = new File(["dummy back"], "aadhaar-back.jpg", { type: "image/jpeg" });

    render(<AadhaarCopyPicker value={{ front: frontFile, back: backFile }} onChange={onChange} />);

    const removeButtons = screen.getAllByTitle("Remove");
    expect(removeButtons.length).toBe(2);

    // Remove front
    fireEvent.click(removeButtons[0]!);
    expect(onChange).toHaveBeenCalledWith({
      front: null,
      back: backFile,
    });
  });

  it("opens enlarged preview modal when enlarge button is clicked", () => {
    const onChange = vi.fn();
    const frontFile = new File(["dummy front"], "aadhaar-front.png", { type: "image/png" });

    render(<AadhaarCopyPicker value={{ front: frontFile, back: null }} onChange={onChange} />);

    const enlargeBtn = screen.getByTitle("View full preview");
    fireEvent.click(enlargeBtn);

    const dialogTitles = screen.getAllByText("aadhaar-front.png");
    expect(dialogTitles.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects non-image files with an error toast", () => {
    const onChange = vi.fn();
    render(<AadhaarCopyPicker value={{ front: null, back: null }} onChange={onChange} />);

    const pdfFile = new File(["dummy pdf content"], "doc.pdf", {
      type: "application/pdf",
    });

    const fileInput = screen.getByTestId("aadhaar-front-input");
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    expect(toast.error).toHaveBeenCalledWith("Upload a photo of the Aadhaar card.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects files larger than 5 MB with an error toast", () => {
    const onChange = vi.fn();
    render(<AadhaarCopyPicker value={{ front: null, back: null }} onChange={onChange} />);

    const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], "large-photo.jpg", {
      type: "image/jpeg",
    });

    const fileInput = screen.getByTestId("aadhaar-front-input");
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    expect(toast.error).toHaveBeenCalledWith("File is larger than 5 MB");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts a dropped valid image file into back dropzone", () => {
    const onChange = vi.fn();
    render(<AadhaarCopyPicker value={{ front: null, back: null }} onChange={onChange} />);

    const backDropzone = screen.getByTestId("aadhaar-back-dropzone");
    const droppedFile = new File(["image data"], "back-card.jpeg", {
      type: "image/jpeg",
    });

    fireEvent.dragOver(backDropzone);
    fireEvent.drop(backDropzone, {
      dataTransfer: {
        files: [droppedFile],
      },
    });

    expect(onChange).toHaveBeenCalledWith({
      front: null,
      back: droppedFile,
    });
  });

  it("supports backward-compatible single file mode", () => {
    const onChange = vi.fn();
    const imageFile = new File(["image"], "card.jpg", { type: "image/jpeg" });
    render(<AadhaarCopyPicker file={imageFile} onChange={onChange} />);

    expect(screen.getByTestId("aadhaar-front-preview-card")).toBeInTheDocument();
    expect(screen.getByText("card.jpg")).toBeInTheDocument();

    const removeBtn = screen.getByTitle("Remove");
    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
