import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findByClientRequest: vi.fn(),
  runStorageDiagnostic: vi.fn(),
  preview: vi.fn(),
  reserveForGeneration: vi.fn(),
  submitGeneration: vi.fn(),
  saveGeneration: vi.fn(),
}));

vi.mock("../repositories/assetRepository.js", () => ({
  assetRepository: {},
  generatedAssetId: vi.fn(),
}));
vi.mock("../repositories/generationRepository.js", () => ({
  generationRepository: {
    findByClientRequest: mocks.findByClientRequest,
    saveGeneration: mocks.saveGeneration,
    recordAttemptLog: vi.fn(),
  },
}));
vi.mock("../services/creditWalletService.js", () => ({
  creditWalletService: {
    simulateReserve: vi.fn(),
    reserveForGeneration: mocks.reserveForGeneration,
    captureForGeneration: vi.fn(),
    releaseForGeneration: vi.fn(),
  },
}));
vi.mock("../services/generatedAssetStorageService.js", () => ({ generatedAssetStorageService: {} }));
vi.mock("../services/assetReferenceResolver.js", () => ({
  assetReferenceResolver: { runStorageDiagnostic: mocks.runStorageDiagnostic },
}));
vi.mock("./adapterRegistry.js", () => ({
  routingV2AdapterRegistry: { get: vi.fn(() => ({ submitGeneration: mocks.submitGeneration })) },
}));
vi.mock("./generationPricingService.js", () => ({
  routingV2GenerationPricingService: { preview: mocks.preview },
}));
vi.mock("./repository.js", () => ({ routingV2Repository: {} }));
vi.mock("./legacyAdapterBridge.js", () => ({ ensureRoutingV2LegacyAdapter: vi.fn() }));
vi.mock("./legacyWrapperAdapter.js", () => ({ createRoutingV2LegacyWrapperAdapter: vi.fn() }));

import { routingV2ExecutionService } from "./executionService.js";

describe("Routing V2 durable storage guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findByClientRequest.mockResolvedValue(null);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    {
      name: "missing storage binding",
      diagnostic: { is_configured: false, write_test: "SKIPPED", read_test: "SKIPPED" },
    },
    {
      name: "failed storage read",
      diagnostic: { is_configured: true, write_test: "PASS", read_test: "FAIL" },
    },
  ])("stops before pricing, credit reservation, or provider submission when $name", async ({ diagnostic }) => {
    mocks.runStorageDiagnostic.mockResolvedValue(diagnostic);

    await expect(
      routingV2ExecutionService.start({
        user_id: "user-1",
        model_id: "seedance-2",
        capability_id: "text-to-video",
        prompt: "test generation",
        client_request_id: "client-request-1",
      }),
    ).rejects.toMatchObject({ code: "ASSET_STORAGE_UNAVAILABLE", status: 503 });

    expect(mocks.runStorageDiagnostic).toHaveBeenCalledOnce();
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.reserveForGeneration).not.toHaveBeenCalled();
    expect(mocks.submitGeneration).not.toHaveBeenCalled();
    expect(mocks.saveGeneration).not.toHaveBeenCalled();
  });
});
