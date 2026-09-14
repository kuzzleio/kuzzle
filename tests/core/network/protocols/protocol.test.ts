import { describe, expect, it } from "vitest";

import type { NetworkEntryPoint } from "../../../../lib/core/network/networkEntryPoint";
import Protocol from "../../../../lib/core/network/protocols/protocol";

/**
 * The base class had no spec at all before TD-41 (#2728) / TD-42 (#2729) — it
 * was converted, and then given a new `init` signature, behind a block whose
 * *aggregate* coverage cleared the gate.
 */
function entryPointStub(
  config: Record<string, unknown> = {},
): NetworkEntryPoint {
  return {
    config: { maxRequestSize: "1MB", ...config },
  } as unknown as NetworkEntryPoint;
}

describe("#core/network/Protocol", () => {
  describe("init", () => {
    // The regression this spec exists for: the first TypeScript conversion
    // widened the first parameter to accept an entry point, and left the body
    // reading the second one — so this exact call type-checked and threw.
    it("accepts the entry point as its only argument", async () => {
      const protocol = new Protocol("test");
      const entryPoint = entryPointStub();

      await expect(protocol.init(entryPoint)).resolves.toBe(true);

      expect(protocol.entryPoint).toBe(entryPoint);
      expect(protocol.maxRequestSize).toBe(1024 * 1024);
      expect(protocol.initCalled).toBe(true);
    });

    it("accepts the deprecated (null, entryPoint) shape the subclasses use", async () => {
      const protocol = new Protocol("test");
      const entryPoint = entryPointStub();

      await expect(protocol.init(null, entryPoint)).resolves.toBe(true);

      expect(protocol.entryPoint).toBe(entryPoint);
      expect(protocol.initCalled).toBe(true);
    });

    it("rejects a missing entry point with a reason", async () => {
      const protocol = new Protocol("test");

      await expect(
        protocol.init(null, undefined as unknown as NetworkEntryPoint),
      ).rejects.toThrow(/expected the network entry point/);
    });

    it("rejects a protocol constructed without a name", async () => {
      const protocol = new Protocol();

      await expect(protocol.init(entryPointStub())).rejects.toThrow(
        /Passing the name in the init method is deprecated/,
      );
    });

    it("rejects a maxRequestSize it cannot parse", async () => {
      const protocol = new Protocol("test");

      await expect(
        protocol.init(entryPointStub({ maxRequestSize: "not a size" })),
      ).rejects.toThrow(/Invalid "maxRequestSize" parameter value/);
    });

    it("copies its own section of server.protocols into config", async () => {
      const protocol = new Protocol<{ port: number }>("mqtt");

      await protocol.init(
        entryPointStub({
          protocols: { mqtt: { port: 1883 }, ws: { port: 7512 } },
        }),
      );

      expect(protocol.config).toEqual({ port: 1883 });
    });

    it("leaves config alone when server.protocols has no section for it", async () => {
      const protocol = new Protocol("test");

      await protocol.init(
        entryPointStub({ protocols: { mqtt: { port: 1883 } } }),
      );

      expect(protocol.config).toEqual({});
    });
  });

  describe("the no-op defaults", () => {
    it("does nothing on broadcast and notify", () => {
      const protocol = new Protocol("test");

      expect(protocol.broadcast({})).toBeUndefined();
      expect(protocol.notify({})).toBeUndefined();
    });

    it("echoes back the channel and connection it was given", () => {
      const protocol = new Protocol("test");

      expect(protocol.joinChannel("chan", "conn")).toEqual({
        channel: "chan",
        connectionId: "conn",
      });
      expect(protocol.leaveChannel("chan", "conn")).toEqual({
        channel: "chan",
        connectionId: "conn",
      });
    });
  });
});
