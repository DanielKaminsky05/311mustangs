import { describe, it, expect } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadZone, type UploadedFile } from "./UploadZone";

/** Stateful harness so the controlled UploadZone behaves like it does in a form. */
function Harness() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  return (
    <div>
      <UploadZone files={files} onChange={setFiles} />
      <output data-testid="count">{files.length}</output>
    </div>
  );
}

function makeFile(name: string, type: string, size = 1024): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function fileInput(): HTMLInputElement {
  // The input is visually hidden but present in the DOM.
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe("UploadZone validation", () => {
  it("accepts a supported image", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.upload(fileInput(), makeFile("photo.png", "image/png"));
    expect(screen.getByText("photo.png")).toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("rejects an unsupported type with an error message", () => {
    render(<Harness />);
    // fireEvent.change bypasses the browser-like accept filter that userEvent
    // applies, so our own guard runs — the Server Function is the real
    // authority in production, and this verifies the client guard too.
    fireEvent.change(fileInput(), {
      target: { files: [makeFile("malware.exe", "application/x-msdownload")] },
    });
    expect(screen.getByText(/unsupported type/i)).toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("rejects a file over the 10 MB limit", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.upload(
      fileInput(),
      makeFile("huge.jpg", "image/jpeg", 11 * 1024 * 1024),
    );
    expect(screen.getByText(/over 10 MB/i)).toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("enforces the 5-file maximum", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const files = Array.from({ length: 6 }, (_, i) =>
      makeFile(`p${i}.png`, "image/png"),
    );
    await user.upload(fileInput(), files);
    expect(screen.getByText(/max 5 files/i)).toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("5");
  });

  it("removes a file when its remove button is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.upload(fileInput(), makeFile("photo.png", "image/png"));
    const item = screen.getByText("photo.png").closest("li") as HTMLElement;
    await user.click(within(item).getByRole("button", { name: /remove/i }));
    expect(screen.queryByText("photo.png")).not.toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });
});
