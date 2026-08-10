import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as kerror from "../../../../lib/kerror";
import ApiKey from "../../../../lib/model/storage/apiKey";
import { sha256 } from "../../../../lib/util/crypto";
import SecurityController from "../../../../lib/api/controllers/securityController";
import { Request } from "../../../../lib/api/request/kuzzleRequest";

describe("/api/controllers/securityController/deleteApiKey", () => {
  let request: Request;
  let securityController: SecurityController;
  let apiKey: { _id: string; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    (globalThis as { kuzzle?: unknown }).kuzzle = {
      ask: vi.fn(),
      log: { child: () => ({ info: vi.fn() }) },
      pipe: vi.fn(),
      pluginsManager: { getStrategyMethod: vi.fn() },
    };

    securityController = new SecurityController();
    request = new Request({
      action: "deleteApiKey",
      controller: "security",
      userId: "mylehuong",
    });

    apiKey = {
      _id: "api-key-id",
      delete: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should delete the API key identified by its _id", async () => {
    request.input.args._id = "api-key-id";
    const loadSpy = vi
      .spyOn(ApiKey, "load")
      .mockResolvedValue(apiKey as unknown as ApiKey);

    const response = await securityController.deleteApiKey(request);

    expect(loadSpy).toHaveBeenCalledWith("mylehuong", "api-key-id");
    expect(apiKey.delete).toHaveBeenCalledWith({ refresh: "wait_for" });
    expect(response).toEqual({ _id: "api-key-id" });
  });

  it("should delete the API key identified by its fingerprint", async () => {
    request.input.args.fingerprint = "the-fingerprint";
    const loadByFingerprintSpy = vi
      .spyOn(ApiKey, "loadByFingerprint")
      .mockResolvedValue(apiKey as unknown as ApiKey);

    const response = await securityController.deleteApiKey(request);

    expect(loadByFingerprintSpy).toHaveBeenCalledWith(
      "mylehuong",
      "the-fingerprint",
    );
    expect(apiKey.delete).toHaveBeenCalledWith({ refresh: "wait_for" });
    expect(response).toEqual({ _id: "api-key-id" });
  });

  it("should delete the API key identified by its clear-text key", async () => {
    request.input.args.key = "the-clear-text-key";
    const loadByFingerprintSpy = vi
      .spyOn(ApiKey, "loadByFingerprint")
      .mockResolvedValue(apiKey as unknown as ApiKey);

    const response = await securityController.deleteApiKey(request);

    expect(loadByFingerprintSpy).toHaveBeenCalledWith(
      "mylehuong",
      sha256("the-clear-text-key"),
    );
    expect(apiKey.delete).toHaveBeenCalledWith({ refresh: "wait_for" });
    expect(response).toEqual({ _id: "api-key-id" });
  });

  it("should give precedence to _id over key and fingerprint", async () => {
    request.input.args._id = "api-key-id";
    request.input.args.key = "the-clear-text-key";
    request.input.args.fingerprint = "the-fingerprint";
    const loadSpy = vi
      .spyOn(ApiKey, "load")
      .mockResolvedValue(apiKey as unknown as ApiKey);
    const loadByFingerprintSpy = vi
      .spyOn(ApiKey, "loadByFingerprint")
      .mockResolvedValue(apiKey as unknown as ApiKey);

    await securityController.deleteApiKey(request);

    expect(loadSpy).toHaveBeenCalledWith("mylehuong", "api-key-id");
    expect(loadByFingerprintSpy).not.toHaveBeenCalled();
  });

  it("should give precedence to key over fingerprint", async () => {
    request.input.args.key = "the-clear-text-key";
    request.input.args.fingerprint = "the-fingerprint";
    const loadByFingerprintSpy = vi
      .spyOn(ApiKey, "loadByFingerprint")
      .mockResolvedValue(apiKey as unknown as ApiKey);

    await securityController.deleteApiKey(request);

    expect(loadByFingerprintSpy).toHaveBeenCalledWith(
      "mylehuong",
      sha256("the-clear-text-key"),
    );
  });

  it("should reject if none of _id, key or fingerprint is provided", async () => {
    const loadSpy = vi
      .spyOn(ApiKey, "load")
      .mockResolvedValue(apiKey as unknown as ApiKey);
    const loadByFingerprintSpy = vi
      .spyOn(ApiKey, "loadByFingerprint")
      .mockResolvedValue(apiKey as unknown as ApiKey);

    await expect(
      securityController.deleteApiKey(request),
    ).rejects.toMatchObject({ id: "api.assert.missing_argument" });

    expect(loadSpy).not.toHaveBeenCalled();
    expect(loadByFingerprintSpy).not.toHaveBeenCalled();
  });

  it("should forward the refresh option", async () => {
    request.input.args._id = "api-key-id";
    request.input.args.refresh = "wait_for";
    vi.spyOn(ApiKey, "load").mockResolvedValue(apiKey as unknown as ApiKey);

    await securityController.deleteApiKey(request);

    expect(apiKey.delete).toHaveBeenCalledWith({ refresh: "wait_for" });
  });

  it("should propagate a not_found error if the API key does not exist", async () => {
    request.input.args.fingerprint = "unknown-fingerprint";
    vi.spyOn(ApiKey, "loadByFingerprint").mockRejectedValue(
      kerror.get("services", "storage", "not_found", "unknown-fingerprint"),
    );

    await expect(
      securityController.deleteApiKey(request),
    ).rejects.toMatchObject({ id: "services.storage.not_found" });
  });
});
