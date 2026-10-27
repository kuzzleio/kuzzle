/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { Vault, CryptonomiconCipher } from "kuzzle-vault";
import isEmpty from "lodash/isEmpty";

// The Vault package remove the variable from env after reading it and we have
// to instantiate the Vault two times with Kaaf (one before init and one after)
//
// `| undefined` is the truth until the first call assigns it. A module-scope
// `let` escapes TypeScript's definite-assignment analysis, so `: string` passed
// strict while being false for every read before that first assignment
// (TD-57, #2760).
let ENV_VAULT_KEY: string | undefined;

/**
 * The default secrets file, `config/secrets.enc.json` at the project root.
 *
 * Installed as an npm package (KaaF), Kuzzle lives under `node_modules/kuzzle`
 * and the project root is above it: from `node_modules/kuzzle/dist/lib/kuzzle`
 * since the build outputs to `dist/` (2.50.0), from
 * `node_modules/kuzzle/lib/kuzzle` before. Anywhere else (a Kuzzle checkout),
 * the file is the checkout's own `config/secrets.enc.json`.
 *
 * @param dirname - the directory of this module
 */
function defaultSecretsFile(dirname: string): string {
  const dir = dirname.split(path.sep).join("/");

  for (const installed of [
    "/node_modules/kuzzle/dist/lib/kuzzle",
    "/node_modules/kuzzle/lib/kuzzle",
  ]) {
    if (dir.endsWith(installed)) {
      return path.resolve(
        dirname.slice(0, dirname.length - installed.length + 1),
        "config/secrets.enc.json",
      );
    }
  }

  return path.resolve(dirname, "../../config/secrets.enc.json");
}

function load(
  vaultKey?: string,
  secretsFile?: string,
  useNewAlgorithm: boolean = false,
): Vault {
  const encryptedSecretsFile =
    secretsFile ||
    process.env.KUZZLE_SECRETS_FILE ||
    defaultSecretsFile(__dirname);

  let key = vaultKey;
  if (
    isEmpty(vaultKey) &&
    (!isEmpty(process.env.KUZZLE_VAULT_KEY) || !isEmpty(ENV_VAULT_KEY))
  ) {
    // Keep the vault key value when reading it from the env
    key = ENV_VAULT_KEY = process.env.KUZZLE_VAULT_KEY || ENV_VAULT_KEY;
  }

  const fileExists = fs.existsSync(encryptedSecretsFile);
  // Abort if a custom secrets file has been provided but Kuzzle can't load it
  if (!isEmpty(process.env.KUZZLE_SECRETS_FILE) || !isEmpty(secretsFile)) {
    assert(
      fileExists,
      `A secret file has been provided but Kuzzle cannot find it at "${encryptedSecretsFile}".`,
    );
  }

  // Abort if a secret file is found (default or custom)
  // but no vault key has been provided
  assert(
    !(fileExists && isEmpty(key)),
    "A secret file has been provided but Kuzzle cannot find the Vault key. Aborting.",
  );

  // Abort if a vault key has been provided
  // but no secrets file can be loaded (default or custom)
  assert(
    !(!isEmpty(key) && !fileExists),
    `A Vault key is present but Kuzzle cannot find the secret file at "${encryptedSecretsFile}". Aborting.`,
  );

  const vault = new Vault(key, {
    cipher: useNewAlgorithm
      ? CryptonomiconCipher.AES_256_GCM
      : CryptonomiconCipher.AES_256_CBC,
  });

  if (key) {
    vault.decrypt(encryptedSecretsFile);
  }

  return vault;
}

export = { defaultSecretsFile, load };
