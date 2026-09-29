import { describe, expect, it } from "vitest";
import { mediaStorageErrorMessage } from "./mediaStorageStatus.js";

describe("media storage error copy", () => {
  it("explains the confirmed Supabase cached-egress restriction", () => {
    expect(mediaStorageErrorMessage("ASSET_STORAGE_QUOTA_RESTRICTED")).toContain(
      "quota de egress em cache foi excedida (HTTP 402)",
    );
  });

  it("translates the legacy generic upload failure without guessing its cause", () => {
    const message = mediaStorageErrorMessage("ASSET_ARCHIVE_UPLOAD_FAILED");
    expect(message).toContain("armazenamento recusou o upload");
    expect(message).toContain("não registrou a causa exata");
    expect(message).toContain("ASSET_ARCHIVE_UPLOAD_FAILED");
  });
});
