import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KuzzleRequest } from "../../../lib/api/request";
import ApiKey from "../../../lib/model/storage/apiKey";
import BaseModel from "../../../lib/model/storage/baseModel";
import type { User } from "../../../lib/model/security/user";
import { sha256 } from "../../../lib/util/crypto";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/** The token `core:security:token:create` answers, as the subject reads it. */
const TOKEN = {
  expiresAt: 42,
  jwt: "jwt-token-encrypted",
  ttl: "1y",
};

describe("#model/storage/ApiKey", () => {
  let ask: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;
  let user: User;

  beforeEach(() => {
    answers = { "core:security:token:create": TOKEN };

    ask = vi.fn(async (event: string) => answers[event]);

    /*
     * `ask` and nothing else: `_afterDelete` and `create` are the only two
     * methods here that reach the application, and both do it through the
     * security-token events. Everything else is `BaseModel`'s, which has its
     * own spec — so the Mocha fixture's `mockrequire`d `clientAdapter` and
     * re-required `storageEngine` were arrangement wired to nothing, as they
     * were in `baseModel`'s.
     */
    stubKuzzle({ ask });

    user = invalid<User>({ _id: "mylehuong" });
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  describe("ApiKey.create", () => {
    beforeEach(() => {
      vi.spyOn(ApiKey.prototype, "save").mockResolvedValue(undefined);
    });

    it("creates a token and stores what identifies it", async () => {
      const apiKey = await ApiKey.create(user, "expiresIn", "Sigfox API key", {
        bypassMaxTTL: true,
        creatorId: "aschen",
        refresh: "wait_for",
      });

      expect(ask).toHaveBeenCalledWith("core:security:token:create", user, {
        bypassMaxTTL: true,
        expiresIn: "expiresIn",
        type: "apiKey",
      });
      expect(ApiKey.prototype.save).toHaveBeenCalledWith({
        refresh: "wait_for",
        userId: "aschen",
      });
      expect(apiKey._source).toMatchObject({
        description: "Sigfox API key",
        expiresAt: 42,
        token: "jwt-token-encrypted",
        ttl: "1y",
        userId: "mylehuong",
      });
    });

    it("passes bypassMaxTTL through as it was given", async () => {
      await ApiKey.create(user, "expiresIn", "Sigfox API key", {
        bypassMaxTTL: false,
        creatorId: "aschen",
        refresh: "wait_for",
      });

      expect(ask).toHaveBeenCalledWith("core:security:token:create", user, {
        bypassMaxTTL: false,
        expiresIn: "expiresIn",
        type: "apiKey",
      });
    });

    it("takes the API key id it is given", async () => {
      const apiKey = await ApiKey.create(user, "expiresIn", "Sigfox API key", {
        apiKeyId: "my-api-key-id",
      });

      expect(apiKey._id).toBe("my-api-key-id");
    });

    /*
     * ⚠️ The fingerprint is `sha256(token.jwt)` — `lib/util/crypto`, not
     * `kuzzle.hash`. The Mocha spec arranged `kuzzle.hash.returns("hashed-jwt-token")`
     * and then asserted `apiKey._id === apiKey._source.fingerprint`, which is
     * true of any two equal values: the stub was wired to nothing and the
     * assertion never said what the id *is*.
     */
    it("falls back to the token's fingerprint as the API key id", async () => {
      const apiKey = await ApiKey.create(user, "expiresIn", "Sigfox API key");

      expect(apiKey._source.fingerprint).toBe(sha256(TOKEN.jwt));
      expect(apiKey._id).toBe(sha256(TOKEN.jwt));
    });

    /* Not covered by the Mocha spec: the token is attached after the save. */
    it("attaches the clear-text token only after storing the key", async () => {
      const apiKey = await ApiKey.create(user, "expiresIn", "Sigfox API key");

      expect(apiKey.token).toBe("jwt-token-encrypted");
    });
  });

  describe("ApiKey.load", () => {
    it("refuses a key that belongs to another user", async () => {
      const load = vi
        .spyOn(BaseModel, "load")
        .mockResolvedValue(invalid({ userId: "mylehuong" }));

      await expect(ApiKey.load("aschen", "api-key-id")).rejects.toMatchObject({
        id: "services.storage.not_found",
      });
      expect(load).toHaveBeenCalledWith("api-key-id");
    });

    /* Not covered by the Mocha spec: the case that is supposed to work. */
    it("answers the key when it belongs to the user", async () => {
      const stored = { userId: "mylehuong" };

      vi.spyOn(BaseModel, "load").mockResolvedValue(invalid(stored));

      expect(await ApiKey.load("mylehuong", "api-key-id")).toBe(stored);
    });
  });

  describe("ApiKey.loadByFingerprint", () => {
    it("searches for the fingerprint, scoped to the user", async () => {
      const apiKey = new ApiKey(
        { fingerprint: "the-fingerprint", userId: "mylehuong" },
        "api-key-id",
      );
      const search = vi.spyOn(ApiKey, "search").mockResolvedValue([apiKey]);

      const result = await ApiKey.loadByFingerprint(
        "mylehuong",
        "the-fingerprint",
      );

      expect(search).toHaveBeenCalledWith(
        {
          query: {
            bool: {
              filter: { term: { fingerprint: "the-fingerprint" } },
              must: { term: { userId: "mylehuong" } },
            },
          },
        },
        { size: 1 },
      );
      expect(result).toBe(apiKey);
    });

    it("refuses a fingerprint nothing matches", async () => {
      vi.spyOn(ApiKey, "search").mockResolvedValue([]);

      await expect(
        ApiKey.loadByFingerprint("mylehuong", "unknown-print"),
      ).rejects.toMatchObject({ id: "services.storage.not_found" });
    });
  });

  describe("ApiKey.loadFromRequest", () => {
    let request: KuzzleRequest;
    let apiKey: ApiKey;

    beforeEach(() => {
      request = new KuzzleRequest({
        action: "deleteApiKey",
        controller: "security",
      });
      apiKey = new ApiKey({ userId: "mylehuong" }, "api-key-id");
    });

    it("loads by _id when the request carries one", async () => {
      request.input.args._id = "api-key-id";
      const load = vi.spyOn(ApiKey, "load").mockResolvedValue(apiKey);
      const loadByFingerprint = vi.spyOn(ApiKey, "loadByFingerprint");

      expect(await ApiKey.loadFromRequest("mylehuong", request)).toBe(apiKey);
      expect(load).toHaveBeenCalledWith("mylehuong", "api-key-id");
      expect(loadByFingerprint).not.toHaveBeenCalled();
    });

    it("hashes the clear-text key when there is no _id", async () => {
      request.input.args.key = "the-clear-text-key";
      const loadByFingerprint = vi
        .spyOn(ApiKey, "loadByFingerprint")
        .mockResolvedValue(apiKey);

      expect(await ApiKey.loadFromRequest("mylehuong", request)).toBe(apiKey);
      expect(loadByFingerprint).toHaveBeenCalledWith(
        "mylehuong",
        sha256("the-clear-text-key"),
      );
    });

    it("takes the fingerprint when there is neither", async () => {
      request.input.args.fingerprint = "the-fingerprint";
      const loadByFingerprint = vi
        .spyOn(ApiKey, "loadByFingerprint")
        .mockResolvedValue(apiKey);

      expect(await ApiKey.loadFromRequest("mylehuong", request)).toBe(apiKey);
      expect(loadByFingerprint).toHaveBeenCalledWith(
        "mylehuong",
        "the-fingerprint",
      );
    });

    /*
     * Not covered by the Mocha spec: `_id` wins over `key`, which wins over
     * `fingerprint`. A request may legitimately carry two of them.
     */
    it("prefers _id over both other spellings", async () => {
      request.input.args._id = "api-key-id";
      request.input.args.key = "the-clear-text-key";
      request.input.args.fingerprint = "the-fingerprint";
      const load = vi.spyOn(ApiKey, "load").mockResolvedValue(apiKey);
      const loadByFingerprint = vi.spyOn(ApiKey, "loadByFingerprint");

      await ApiKey.loadFromRequest("mylehuong", request);

      expect(load).toHaveBeenCalledWith("mylehuong", "api-key-id");
      expect(loadByFingerprint).not.toHaveBeenCalled();
    });

    it("refuses a request carrying none of the three", async () => {
      await expect(
        ApiKey.loadFromRequest("mylehuong", request),
      ).rejects.toMatchObject({ id: "api.assert.missing_argument" });
    });
  });

  describe("ApiKey.deleteByUser", () => {
    it("deletes every key the user owns", async () => {
      const deleteByQuery = vi
        .spyOn(ApiKey, "deleteByQuery")
        .mockResolvedValue(undefined);

      await ApiKey.deleteByUser(user, { refresh: "wait_for" });

      expect(deleteByQuery).toHaveBeenCalledWith(
        { term: { userId: "mylehuong" } },
        { refresh: "wait_for" },
      );
    });
  });

  describe("#_afterDelete", () => {
    it("deletes the token the key stands for", async () => {
      const token = { _id: "token-id" };

      answers["core:security:token:get"] = token;

      const apiKey = new ApiKey({
        token: "encrypted-token",
        userId: "userId",
      });

      await apiKey._afterDelete();

      expect(ask).toHaveBeenCalledWith(
        "core:security:token:get",
        "userId",
        "encrypted-token",
      );
      expect(ask).toHaveBeenCalledWith("core:security:token:delete", token);
    });

    /*
     * Not covered by the Mocha spec: the token may already be gone — expired,
     * or revoked with the user — and the guard is what keeps deleting an API
     * key from failing on it.
     */
    it("does nothing when the token is already gone", async () => {
      answers["core:security:token:get"] = null;

      const apiKey = new ApiKey({
        token: "encrypted-token",
        userId: "userId",
      });

      await apiKey._afterDelete();

      expect(ask).not.toHaveBeenCalledWith(
        "core:security:token:delete",
        expect.anything(),
      );
    });
  });

  describe("#serialize", () => {
    it("hides the token unless it is asked for", () => {
      const apiKey = new ApiKey(
        { token: "encrypted-token", userId: "mylehuong" },
        "api-key-id",
      );

      expect(apiKey.serialize()).toEqual({
        _id: "api-key-id",
        _source: { userId: "mylehuong" },
      });
    });

    it("includes it when it is", () => {
      const apiKey = new ApiKey(
        { token: "encrypted-token", userId: "mylehuong" },
        "api-key-id",
      );

      expect(apiKey.serialize({ includeToken: true })).toEqual({
        _id: "api-key-id",
        _source: { token: "encrypted-token", userId: "mylehuong" },
      });
    });

    /*
     * ⚠️ `serialize()` deletes the token from the object `super.serialize()`
     * answers — and that object's `_source` **is** the model's own
     * `__source`, not a copy. So hiding the token from one caller removes it
     * from the model. The Mocha spec built two separate instances to assert
     * the two cases, which is what kept the order from mattering; asserted
     * here because the next reader of a serialized key deserves to know.
     */
    it("removes the token from the model itself, not from a copy", () => {
      const apiKey = new ApiKey(
        { token: "encrypted-token", userId: "mylehuong" },
        "api-key-id",
      );

      apiKey.serialize();

      expect(apiKey._source.token).toBeUndefined();
      expect(apiKey.serialize({ includeToken: true })).toEqual({
        _id: "api-key-id",
        _source: { userId: "mylehuong" },
      });
    });
  });
});
