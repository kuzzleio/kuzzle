import { describe, expect, it } from "vitest";

import defaultConfig from "../../lib/config/default.config";
import {
  isSecretKey,
  redactSecrets,
  redactUrlCredentials,
  toPublicConfig,
} from "../../lib/util/redactSecrets";

describe("#util/redactSecrets", () => {
  describe("#isSecretKey", () => {
    it.each([
      // exact names
      "key",
      "pfx",
      "auth",
      "KEY",
      "Auth",
      // suffixes
      "password",
      "sentinelPassword",
      "passphrase",
      "secret",
      "clientSecret",
      "apiKey",
      "token",
      "accessToken",
      "credentials",
      "privateKey",
      "secretKey",
      "signingKey",
      "encryptionKey",
      "secretAccessKey",
      "AWS_SECRET_ACCESS_KEY",
      "VAULT_KEY",
      "kuzzle_services__internalCache__options__password",
      "REDIS_PASSWORD",
    ])("treats %s as a secret", (name) => {
      expect(isSecretKey(name)).toBe(true);
    });

    it.each([
      "cookieAuthentication",
      "authenticators",
      "keys",
      "keyPrefix",
      "monkey",
      "passwordPolicies",
      "resetPasswordExpiresIn",
      "tokenTTL",
      "username",
      "host",
      "tls",
      "cert",
      "mappings",
      "secretless",
      "accessKeyId",
      "AWS_ACCESS_KEY_ID",
    ])("does not treat %s as a secret", (name) => {
      expect(isSecretKey(name)).toBe(false);
    });
  });

  describe("#redactUrlCredentials", () => {
    it("masks the password of a URL, keeps the user", () => {
      expect(redactUrlCredentials("https://elastic:changeme@es:9200")).toBe(
        "https://elastic:***@es:9200",
      );
      expect(redactUrlCredentials("redis://:s3cr3t@redis:6379/0")).toBe(
        "redis://:***@redis:6379/0",
      );
    });

    it("masks every URL of a string", () => {
      expect(redactUrlCredentials("http://a:b@h1, http://c:d@h2")).toBe(
        "http://a:***@h1, http://c:***@h2",
      );
    });

    it("leaves strings without URL credentials untouched", () => {
      for (const text of [
        "http://es:9200",
        "http://user@es:9200",
        "mailto:support@kuzzle.io",
        "foo:bar@baz",
        "plain text",
      ]) {
        expect(redactUrlCredentials(text)).toBe(text);
      }
    });
  });

  describe("#redactSecrets", () => {
    it("masks a value under a secret key and keeps the field", () => {
      expect(
        redactSecrets({ host: "redis", password: "s3cr3t", port: 6379 }),
      ).toEqual({ host: "redis", password: "***", port: 6379 });
    });

    it("masks numbers and empty strings under a secret key", () => {
      expect(redactSecrets({ password: 123, token: "" })).toEqual({
        password: "***",
        token: "***",
      });
    });

    it("keeps null, undefined and booleans under a secret key", () => {
      const result = redactSecrets({
        apiKey: undefined,
        password: null,
        requirePassword: false,
        token: true,
      });

      expect(result).toStrictEqual({
        apiKey: undefined,
        password: null,
        requirePassword: false,
        token: true,
      });
    });

    it("leaves cookieAuthentication alone", () => {
      expect(redactSecrets({ cookieAuthentication: true })).toEqual({
        cookieAuthentication: true,
      });
    });

    it("descends into nested objects and arrays", () => {
      expect(
        redactSecrets({
          a: { b: { password: "x", user: "y" } },
          list: [{ name: "n", secret: "z" }],
        }),
      ).toEqual({
        a: { b: { password: "***", user: "y" } },
        list: [{ name: "n", secret: "***" }],
      });
    });

    it("keeps the structure of a plain object under a secret key, its leaves masked", () => {
      expect(
        redactSecrets({
          auth: {
            nested: { flag: true, value: "v" },
            password: "p",
            username: "elastic",
          },
        }),
      ).toEqual({
        auth: {
          nested: { flag: true, value: "***" },
          password: "***",
          username: "***",
        },
      });
    });

    it("masks a Buffer or an array under a secret key whole", () => {
      const result = redactSecrets({
        tls: {
          ca: Buffer.from("public"),
          key: Buffer.from("-----BEGIN PRIVATE KEY-----"),
          pfx: [Buffer.from("a"), Buffer.from("b")],
        },
      });

      expect(result.tls.key).toBe("***");
      expect(result.tls.pfx).toBe("***");
      // Redaction runs before the JSON clone: what the clone produces holds
      // no trace of the key.
      expect(JSON.stringify(result)).not.toContain("PRIVATE");
      expect(Buffer.isBuffer(result.tls.ca)).toBe(true);
    });

    it("masks URL credentials in every string, whatever the key", () => {
      expect(
        redactSecrets({
          node: "https://u:p@es:9200",
          nodes: ["https://u:p@es1", "https://es2"],
        }),
      ).toEqual({
        node: "https://u:***@es:9200",
        nodes: ["https://u:***@es1", "https://es2"],
      });
    });

    it("never redacts a mappings subtree", () => {
      const mappings = {
        properties: {
          password: { type: "keyword" },
          token: { type: "keyword" },
        },
      };

      const result = redactSecrets({
        collections: { "api-keys": { mappings } },
      });

      expect(result.collections["api-keys"].mappings).toEqual(mappings);
    });

    it("does not mutate its input", () => {
      const key = Buffer.from("k");
      const input = {
        list: [{ token: "t" }],
        nested: { password: "p", url: "http://a:b@c" },
        tls: { key },
      };

      const result = redactSecrets(input);

      expect(input).toEqual({
        list: [{ token: "t" }],
        nested: { password: "p", url: "http://a:b@c" },
        tls: { key },
      });
      expect(key.toString()).toBe("k");
      expect(result).not.toBe(input);
      expect(result.nested).not.toBe(input.nested);
      expect(result.list).not.toBe(input.list);
    });

    it("passes scalars through", () => {
      expect(redactSecrets(42)).toBe(42);
      expect(redactSecrets(null)).toBe(null);
      expect(redactSecrets("http://a:b@c")).toBe("http://a:***@c");
    });
  });

  describe("#toPublicConfig", () => {
    it("drops http.routes, security and VAULT_KEY, then redacts", () => {
      const config = {
        VAULT_KEY: "vault",
        http: { accessControlAllowOrigin: "*", routes: [{ a: 1 }] },
        security: { authToken: { secret: "s" } },
        services: { internalCache: { options: { password: "p" } } },
      };

      const result = toPublicConfig(config);

      expect(result).toEqual({
        http: { accessControlAllowOrigin: "*" },
        services: { internalCache: { options: { password: "***" } } },
      });
      expect(result).not.toHaveProperty("security");
      expect(result).not.toHaveProperty("VAULT_KEY");
      expect(result.http).not.toHaveProperty("routes");
      // input untouched
      expect(config.http.routes).toEqual([{ a: 1 }]);
      expect(config.security.authToken.secret).toBe("s");
      expect(config.VAULT_KEY).toBe("vault");
    });

    it("accepts a configuration without an http section", () => {
      expect(toPublicConfig({ dump: { path: "/tmp" } })).toEqual({
        dump: { path: "/tmp" },
      });
    });

    /*
     * The packaged defaults are the false-positive canary: anything masked
     * here is a field an operator reading getConfig would miss.
     */
    it("leaves the packaged defaults readable", () => {
      const result = JSON.parse(JSON.stringify(toPublicConfig(defaultConfig)));
      const expected = JSON.parse(JSON.stringify(defaultConfig));

      delete expected.security;
      delete expected.http.routes;

      expect(result).toEqual(expected);
      expect(
        result.services.storageEngine.internalIndex.collections["api-keys"]
          .mappings.properties.token,
      ).toBeDefined();
      expect(
        result.plugins["kuzzle-plugin-auth-passport-local"].requirePassword,
      ).toBe(false);
    });
  });
});
