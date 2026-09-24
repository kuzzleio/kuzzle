import { beforeEach, describe, expect, it } from "vitest";

import { invalid } from "../../helpers/invalid";

import ClientConnection from "../../../lib/core/network/clientConnection";

describe("core/network/clientConnection", () => {
  describe("#constructor", () => {
    let headers: Record<string, string>;
    let connection: ClientConnection;

    beforeEach(() => {
      headers = { foo: "bar" };
      connection = new ClientConnection("protocol", ["ip1", "ip2"], headers);
    });

    it("throws if ips is not an array", () => {
      const build = () =>
        new ClientConnection("protocol", invalid<string[]>("ips"));

      expect(build).toThrow(TypeError);
      expect(build).toThrow("Expected ips to be an Array, got string");
    });

    it("sets headers", () => {
      expect(connection.headers).toBe(headers);
    });
  });
});
