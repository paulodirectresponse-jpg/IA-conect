import { describe, expect, it } from "vitest";
import { publicGeneration } from "./publicGeneration.js";

describe("public generation storage state", () => {
  it("returns pending provider output separately from durable assets", () => {
    const output = publicGeneration({
      generation_id: "gen-1",
      user_id: "owner-1",
      status: "PROCESSING",
      result_url: "https://provider.example/temporary.mp4",
      result_urls: ["https://provider.example/temporary.mp4"],
      provider_result_urls: ["https://provider.example/temporary.mp4", "http://invalid.example/file"],
      media_storage_status: "PENDING",
      media_storage_error_code: "ASSET_STORAGE_QUOTA_RESTRICTED",
    });

    expect(output).toMatchObject({
      result_url: null,
      result_urls: [],
      pending_result_urls: ["https://provider.example/temporary.mp4"],
      media_storage_status: "PENDING",
      media_storage_error_code: "ASSET_STORAGE_QUOTA_RESTRICTED",
    });
    expect(output).not.toHaveProperty("provider_result_urls");
  });

  it("never exposes temporary provider URLs after archive completion", () => {
    const output = publicGeneration({
      generation_id: "gen-2",
      status: "SUCCEEDED",
      provider_result_urls: ["https://provider.example/temporary.mp4"],
      media_storage_status: "READY",
      media_storage_error_code: "ASSET_STORAGE_QUOTA_RESTRICTED",
      result_url: "https://storage.example/durable.mp4",
      result_urls: ["https://storage.example/durable.mp4"],
    });

    expect(output.pending_result_urls).toBeUndefined();
    expect(output.media_storage_error_code).toBeNull();
    expect(output.result_url).toBe("https://storage.example/durable.mp4");
  });
});
