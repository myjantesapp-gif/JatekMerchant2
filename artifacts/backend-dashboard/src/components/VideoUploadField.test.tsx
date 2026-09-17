import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VideoUploadField, isValidSplashVideoSource } from "./VideoUploadField";

vi.mock("@/lib/upload", () => ({
  uploadVideo: vi.fn(),
  validateVideoFile: vi.fn(() => null),
}));

describe("VideoUploadField splash mode", () => {
  it("uses the same direct MP4 and managed splash URL rules as the API", () => {
    expect(isValidSplashVideoSource("")).toBe(true);
    expect(isValidSplashVideoSource("/api/storage/objects/splash/intro?v=2")).toBe(true);
    expect(isValidSplashVideoSource("https://cdn.example.com/intro.mp4?v=2")).toBe(true);
    expect(isValidSplashVideoSource("http://cdn.example.com/intro.mp4")).toBe(false);
    expect(isValidSplashVideoSource("https://youtube.com/watch?v=abcdefghijk")).toBe(false);
    expect(isValidSplashVideoSource("/api/storage/objects/splash/intro#fragment")).toBe(false);
  });

  it("disables text and file selection while its parent is saving", () => {
    const { container } = render(
      <VideoUploadField
        label="Intro"
        value=""
        uploadKind="splash"
        disabled
        onValueChange={vi.fn()}
      />,
    );

    expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /choisir une vidéo/i }) as HTMLButtonElement).disabled).toBe(true);
    for (const input of container.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
      expect(input.disabled).toBe(true);
    }
  });
});