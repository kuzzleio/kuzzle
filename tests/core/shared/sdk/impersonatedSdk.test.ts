import { beforeEach, describe, expect, it, vi } from "vitest";

// The barrel's KEYS are all this module reads — it maps them to SDK controller
// names ("DocumentController" -> "document", "MemoryStorageController" -> "ms").
vi.mock("../../../../lib/api/controllers", () => ({
  default: {
    DocumentController: class {},
    MemoryStorageController: class {},
    UnknownController: class {},
  },
}));

import ImpersonatedSDK from "../../../../lib/core/shared/sdk/impersonatedSdk";

/** Stands in for one of the real SDK controllers. */
class SdkDocumentController {
  query = vi.fn();

  async create(index: string, collection: string) {
    // The real SDK actions call `this.query(...)`; the impersonated context is
    // expected to substitute its own.
    return (
      this as unknown as { query: (r: unknown, o?: unknown) => unknown }
    ).query({ action: "create", collection, index });
  }

  aLocalHelper() {
    return "local";
  }
}

describe("#core/shared/sdk/ImpersonatedSDK", () => {
  let sdkQuery: ReturnType<typeof vi.fn>;
  let documentController: SdkDocumentController;

  beforeEach(() => {
    sdkQuery = vi.fn().mockResolvedValue({ result: "ok" });
    documentController = new SdkDocumentController();

    (globalThis as { app?: unknown }).app = {
      sdk: {
        document: documentController,
        // no `ms` entry: the module must skip a controller the SDK lacks
        query: sdkQuery,
      },
    };
  });

  describe("#constructor", () => {
    it("records the impersonated kuid and defaults checkRights to false", () => {
      const sdk = new ImpersonatedSDK("kuid-1");

      expect(sdk.kuid).toBe("kuid-1");
      expect(sdk.checkRights).toBe(false);
    });

    it("honours the checkRights option", () => {
      expect(
        new ImpersonatedSDK("kuid-1", { checkRights: true }).checkRights,
      ).toBe(true);
    });

    it("exposes only the controllers the SDK actually has", () => {
      const sdk = new ImpersonatedSDK("kuid-1");

      expect(Reflect.get(sdk, "document")).toBeDefined();
      // "MemoryStorageController" maps to "ms", absent from the fake SDK.
      expect(Reflect.get(sdk, "ms")).toBeUndefined();
      expect(Reflect.get(sdk, "unknown")).toBeUndefined();
    });
  });

  describe("the controller proxy", () => {
    it("is built lazily and cached across accesses", () => {
      const sdk = new ImpersonatedSDK("kuid-1");

      const first = Reflect.get(sdk, "document");
      const second = Reflect.get(sdk, "document");

      expect(first).toBe(second);
    });

    it("routes an SDK action through ImpersonatedSDK.query, tagging the controller", async () => {
      const sdk = new ImpersonatedSDK("kuid-1", { checkRights: true });

      await Reflect.get(sdk, "document").create("index", "collection");

      expect(sdkQuery).toHaveBeenCalledOnce();
      expect(sdkQuery.mock.calls[0][0]).toMatchObject({
        __checkRights__: true,
        __kuid__: "kuid-1",
        action: "create",
        collection: "collection",
        controller: "document",
        index: "index",
      });
      // The controller's own query must never be reached.
      expect(documentController.query).not.toHaveBeenCalled();
    });

    it("carries the controller's other prototype methods into the custom context", () => {
      const sdk = new ImpersonatedSDK("kuid-1");

      expect(Reflect.get(sdk, "document").aLocalHelper()).toBe("local");
    });
  });

  describe("#query", () => {
    it("injects the impersonation fields and delegates to the SDK", async () => {
      const sdk = new ImpersonatedSDK("kuid-2", { checkRights: true });
      const request = { action: "get", controller: "document" };

      await sdk.query(request, { queuable: false });

      expect(sdkQuery).toHaveBeenCalledWith(request, { queuable: false });
      expect(request).toMatchObject({
        __checkRights__: true,
        __kuid__: "kuid-2",
      });
    });

    it("defaults the options to an empty object", async () => {
      const sdk = new ImpersonatedSDK("kuid-2");

      await sdk.query({ action: "get", controller: "document" });

      expect(sdkQuery.mock.calls[0][1]).toEqual({});
    });
  });
});
