import fs from "node:fs";

import type { CryptonomiconCipher } from "kuzzle-vault";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every `new Vault(...)` the module makes, in order. The cipher is chosen at
 * construction time and nowhere else, so this is what "which cipher was
 * selected" means — the Mocha spec reassigned `kuzzleVault.Vault` to a stub to
 * read it, which an ES module namespace does not allow.
 */
const recorded = vi.hoisted(() => ({
  calls: [] as Array<{ key?: string; cipher?: string }>,
}));

vi.mock("kuzzle-vault", async (importOriginal) => {
  const actual = await importOriginal<typeof import("kuzzle-vault")>();

  /* The real Vault, recording its arguments: stubbing it out entirely would
   * also stub `decrypt`, and three of the tests below assert on what a real
   * `decrypt` does with a key it cannot use. */
  class RecordingVault extends actual.Vault {
    constructor(vaultKey?: string, options?: { cipher?: CryptonomiconCipher }) {
      recorded.calls.push({ key: vaultKey, cipher: options?.cipher });
      super(vaultKey, options);
    }
  }

  return { ...actual, Vault: RecordingVault };
});

/**
 * `load()` memoises the vault key in module state, on purpose: kuzzle-vault
 * deletes KUZZLE_VAULT_KEY from the environment after reading it, and Kaaf
 * instantiates the vault twice. A fresh copy per test keeps that state from
 * leaking into the next one — and lets one test drive it deliberately.
 */
async function freshVault() {
  vi.resetModules();

  return (await import("../../lib/kuzzle/vault")).default;
}

describe("#kuzzle/vault", () => {
  let vault: Awaited<ReturnType<typeof freshVault>>;
  let existsSync: ReturnType<typeof vi.spyOn>;

  /** The error `load()` threw, or `undefined`. */
  function loadError(...args: Parameters<typeof vault.load>) {
    try {
      vault.load(...args);
    } catch (error) {
      return error as Error;
    }

    return undefined;
  }

  beforeEach(async () => {
    existsSync = vi.spyOn(fs, "existsSync");
    recorded.calls.length = 0;

    delete process.env.KUZZLE_VAULT_KEY;
    delete process.env.KUZZLE_SECRETS_FILE;

    vault = await freshVault();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw if the provided secrets file cannot be found", () => {
    existsSync.mockReturnValue(false);

    expect(() => vault.load("secret key", "config/secrets.enc.json")).toThrow(
      /A secret file has been provided but Kuzzle cannot find it at/,
    );
  });

  it("should throw if a secrets file is found but no vault key is given", () => {
    existsSync.mockReturnValue(true);

    expect(() => vault.load()).toThrow(
      "A secret file has been provided but Kuzzle cannot find the Vault key. Aborting.",
    );
  });

  it("should throw if a vault key is given but no secrets file is found", () => {
    existsSync.mockReturnValue(false);

    expect(() => vault.load("secret key")).toThrow(
      /A Vault key is present but Kuzzle cannot find the secret file at/,
    );
  });

  it("should return an undecrypted vault when neither is provided", () => {
    existsSync.mockReturnValue(false);

    const loaded = vault.load();

    expect(loaded).toBeTypeOf("object");
    expect(loaded.secrets).toEqual({});
  });

  it("should read the vault key from the environment", () => {
    existsSync.mockReturnValue(true);
    process.env.KUZZLE_VAULT_KEY = "secret key";

    const error = loadError();

    // `should(...).throw()` with no matcher was the old assertion, and it held
    // whether or not the environment was read: with no key, load() throws the
    // missing-key assertion instead. What proves the key was read is *which*
    // error comes back — decryption was attempted, so it is not that one
    // (TD-57, #2760).
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).not.toMatch(
      /^A secret file has been provided but Kuzzle cannot find the Vault key/,
    );
  });

  it("should remember the vault key once the environment has been cleared", () => {
    existsSync.mockReturnValue(true);
    process.env.KUZZLE_VAULT_KEY = "secret key";

    loadError();

    // What kuzzle-vault does to the environment after reading it, and the whole
    // reason the module keeps the key: Kaaf loads the vault twice, once before
    // init and once after.
    delete process.env.KUZZLE_VAULT_KEY;

    const error = loadError();

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).not.toMatch(
      /^A secret file has been provided but Kuzzle cannot find the Vault key/,
    );
  });

  it("should not carry a remembered key into a fresh process", async () => {
    existsSync.mockReturnValue(true);
    process.env.KUZZLE_VAULT_KEY = "secret key";

    loadError();

    delete process.env.KUZZLE_VAULT_KEY;
    vault = await freshVault();

    expect(loadError()?.message).toMatch(
      /^A secret file has been provided but Kuzzle cannot find the Vault key/,
    );
  });

  describe("#cipher selection", () => {
    beforeEach(() => {
      existsSync.mockReturnValue(true);
    });

    /* `load()` goes on to decrypt a file that is not there, so the call is the
     * assertion's subject, not its result: what is under test is the cipher
     * the Vault was constructed with. */
    it("should use the legacy AES-256-CBC cipher by default", () => {
      loadError("the spoon does not exist", "config/secrets.enc.json");

      expect(recorded.calls).toEqual([
        { key: "the spoon does not exist", cipher: "aes-256-cbc" },
      ]);
    });

    it("should use the legacy AES-256-CBC cipher when the new algorithm is not opted in", () => {
      loadError("the spoon does not exist", "config/secrets.enc.json", false);

      expect(recorded.calls).toEqual([
        { key: "the spoon does not exist", cipher: "aes-256-cbc" },
      ]);
    });

    it("should use the AES-256-GCM cipher when the new algorithm is opted in", () => {
      loadError("the spoon does not exist", "config/secrets.enc.json", true);

      expect(recorded.calls).toEqual([
        { key: "the spoon does not exist", cipher: "aes-256-gcm" },
      ]);
    });
  });
});
