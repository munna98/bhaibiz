import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { AadhaarInput, getCursorPositionAfterDigits } from "@/components/workers/AadhaarInput";

function ControlledAadhaarInput({ initial = "", onClearError }: { initial?: string; onClearError?: () => void }) {
  const [val, setVal] = useState(initial);
  return <AadhaarInput value={val} onChange={setVal} onClearError={onClearError} placeholder="1234 5678 9012" />;
}

describe("getCursorPositionAfterDigits", () => {
  it("returns 0 for 0 digits", () => {
    expect(getCursorPositionAfterDigits("2332 4354 3385", 0)).toBe(0);
  });
  it("positions correctly within first group", () => {
    expect(getCursorPositionAfterDigits("2332 4354 3385", 2)).toBe(2);
  });
  it("moves past space if target digit is at boundary", () => {
    // 4 digits: "2332" is followed by space in "2332 4354 3385" -> positions after space at 5
    expect(getCursorPositionAfterDigits("2332 4354 3385", 4)).toBe(5);
  });
  it("positions correctly in middle group", () => {
    // 6 digits: 4 digits + space + 2 digits -> index 7
    expect(getCursorPositionAfterDigits("2332 4354 3385", 6)).toBe(7);
  });
});

describe("AadhaarInput component", () => {
  it("formats digits with spaces every 4 digits", () => {
    render(<ControlledAadhaarInput initial="233243543385" />);
    const input = screen.getByPlaceholderText("1234 5678 9012") as HTMLInputElement;
    expect(input.value).toBe("2332 4354 3385");
  });

  it("limits entered input to 12 digits and ignores letters", () => {
    render(<ControlledAadhaarInput />);
    const input = screen.getByPlaceholderText("1234 5678 9012") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2332abc435433859999" } });
    expect(input.value).toBe("2332 4354 3385");
  });

  it("calls onClearError when typing or backspacing", () => {
    const onClearError = vi.fn();
    render(<ControlledAadhaarInput initial="2332" onClearError={onClearError} />);
    const input = screen.getByPlaceholderText("1234 5678 9012") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "23324" } });
    expect(onClearError).toHaveBeenCalled();
  });

  it("deletes the digit before a space when Backspace is pressed after a space", () => {
    render(<ControlledAadhaarInput initial="23324354" />);
    const input = screen.getByPlaceholderText("1234 5678 9012") as HTMLInputElement;
    expect(input.value).toBe("2332 4354");

    // Position cursor right after the space (index 5: "2332 |4354")
    input.setSelectionRange(5, 5);
    fireEvent.keyDown(input, { key: "Backspace" });

    // The '2' before the space should have been deleted -> "2334 354"
    expect(input.value).toBe("2334 354");
  });

  it("deletes the digit after a space when Delete is pressed right before a space", () => {
    render(<ControlledAadhaarInput initial="23324354" />);
    const input = screen.getByPlaceholderText("1234 5678 9012") as HTMLInputElement;
    expect(input.value).toBe("2332 4354");

    // Position cursor right before the space (index 4: "2332| 4354")
    input.setSelectionRange(4, 4);
    fireEvent.keyDown(input, { key: "Delete" });

    // The '4' after the space should have been deleted -> "2332 354"
    expect(input.value).toBe("2332 354");
  });
});
