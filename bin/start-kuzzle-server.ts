#!/usr/bin/env node

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

/* eslint-disable no-console */

import * as fs from "fs";
import { createRequire } from "module";
import { join } from "path";

import type { JSONObject } from "kuzzle-sdk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

/**
 * The production container's entrypoint: `docker/images/kuzzle/Dockerfile` runs
 * `node ./bin/start-kuzzle-server` from `dist/`, which is why the import below
 * is relative — from `dist/bin/`, `../index` is `dist/index.js`, the package's
 * own `main`. Keep it that way.
 */
import { Backend } from "../index";
import type { DefaultMappings } from "../lib/core/backend/backendImport";

type ServerOptions = {
  enablePlugins?: string;
  fixtures?: string;
  mappings?: string;
  secretsFile?: string;
  securities?: string;
  vaultKey?: string;
};

/**
 * Parses one of the JSON files the command line points at. The type parameter
 * is a *claim about the file*, not a check: `JSON.parse` answers `any` and this
 * is the boundary where that stops. What each file must actually contain is
 * validated by the `import` method it is handed to, which throws a named
 * assertion error rather than failing later and elsewhere.
 */
/**
 * Resolves a plugin fixture relative to *this file*, which is what the bare
 * `require("./plugins/available/…")` this replaces did. `createRequire` rather
 * than `require`: the entrypoint is TypeScript now, and a bare `require` call
 * is an error under the repo's ESLint configuration.
 *
 * ⚠️ `--enable-plugins` only has something to load when the entrypoint runs
 * from the source tree: `bin/plugins/` is not part of the published build, so
 * in the container there is nothing under `pluginsDir`. `startKuzzle` checks
 * each plugin's directory first and skips a missing one with a warning:
 * v2.56.0 ignored the option altogether, and fixing its parsing (TD-84) was not
 * meant to turn it into a `MODULE_NOT_FOUND` at boot. See
 * docs/adr-001/type-debt-register.md, TD-84.
 */
const loadPlugin = createRequire(__filename);
const pluginsDir = join(__dirname, "plugins", "available");

function loadJson<T>(path: string): T {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

/**
 * Reads one string option off yargs' answer. Every option this script declares
 * takes a value, so anything else on the command line is a user error rather
 * than a shape to accommodate.
 */
function stringOption(
  argv: Record<string, unknown>,
  name: keyof ServerOptions,
): string | undefined {
  const value = argv[name];

  if (value === undefined) {
    return undefined;
  }

  // yargs reads `--vault-key 12345` as a number and a repeated option as an
  // array: "expects a value" would send the user looking for an argument that
  // is not missing. Named the way it is typed, not yargs' camelCase key.
  const flag = `--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

  if (value === true) {
    throw new Error(`${flag} expects a value`);
  }

  if (typeof value !== "string") {
    throw new Error(
      `${flag} expects a single string value, got ${JSON.stringify(value)}`,
    );
  }

  return value;
}

async function startKuzzle(options: ServerOptions = {}): Promise<void> {
  const app = new Backend("kuzzle");

  if (options.enablePlugins) {
    const additionalPlugins = options.enablePlugins
      .trim()
      .split(",")
      .map((x) => x.trim().replace(/(^")|("$)/g, ""));

    for (const additionalPlugin of additionalPlugins) {
      if (!fs.existsSync(join(pluginsDir, additionalPlugin))) {
        app.log.warn(
          `[!] --enable-plugins: plugin "${additionalPlugin}" not found in ${pluginsDir}, ignored (the option only works from a source checkout)`,
        );
        continue;
      }

      const pluginPath = `./plugins/available/${additionalPlugin}`;
      const PluginClass = loadPlugin(pluginPath);
      const manifest = loadPlugin(`${pluginPath}/manifest.json`);
      const plugin = new PluginClass();

      try {
        plugin.version = loadPlugin(`${pluginPath}/package.json`).version;
      } catch {
        // ignore
      }

      app.plugin.use(plugin, { manifest, name: manifest.name });
    }
  }

  // ⚠️ These three used to be *assignments* — `app.import.mappings = json`,
  // `app.import.fixtures = json`, `app.import.securities = json`. `import`
  // exposes methods, and only `mappings` among those names: the first
  // assignment replaced the method, and the other two invented properties
  // nothing reads. So `--mappings`, `--fixtures` and `--securities` had been
  // accepted and ignored. Typing the entrypoint is what said so; see
  // docs/adr-001/type-debt-register.md, TD-84.
  if (options.mappings) {
    app.import.mappings(loadJson<DefaultMappings>(options.mappings));
  }

  if (options.securities) {
    const securities = loadJson<{
      profiles?: JSONObject;
      roles?: JSONObject;
      users?: JSONObject;
    }>(options.securities);

    // The shape `admin:loadSecurities` takes, which is what an admin-console
    // export writes: roles, then profiles, then users.
    if (securities.roles) {
      app.import.roles(securities.roles);
    }

    if (securities.profiles) {
      app.import.profiles(securities.profiles);
    }

    if (securities.users) {
      app.import.users(securities.users);
    }
  }

  // Assigned only when given: the setters take a `string`, and writing `""`
  // for an absent key is a different claim from not setting one at all.
  if (options.vaultKey) {
    app.vault.key = options.vaultKey;
  }

  if (options.secretsFile) {
    app.vault.file = options.secretsFile;
  }

  app.version = "1.0.0";

  await app.start();

  // Data fixtures have no `import` counterpart — they are documents, loaded
  // through the API once the storage layer is up, the way `admin:loadFixtures`
  // does it.
  if (options.fixtures) {
    await app.sdk.query({
      action: "loadFixtures",
      body: loadJson<JSONObject>(options.fixtures),
      controller: "admin",
    });
  }

  // `searchUsers` answers a *count* in `total`, not a list: the previous
  // `admins.length === 0` read `.length` off a number, which is `undefined`,
  // so this warning never printed either.
  const { total: admins } = await app.sdk.security.searchUsers({
    query: { term: { profileIds: "admin" } },
  });

  if (admins === 0) {
    app.log.warn(
      "[!] [WARNING] There is no administrator user yet: everyone has administrator rights.",
    );
    app.log.warn(
      "[ℹ]  You can use the CLI or the admin console to create the first administrator user.",
    );
    app.log.warn(
      "    For more information: https://docs.kuzzle.io/core/2/guides/essentials/security/",
    );
  }
}

// ⚠️ `hideBin(process.argv)`, not `yargs()`. A bare `yargs()` parses an *empty*
// argument list — it is the ESM factory, and the process arguments have to be
// handed to it — so every option below was declared, documented in `--help`,
// and then read off an object that never had them. See
// docs/adr-001/type-debt-register.md, TD-84.
const argv = yargs(hideBin(process.argv))
  .scriptName("kuzzle")
  .usage("start-kuzzle-server [options]")
  .describe("fixtures", "Import data from file")
  .describe("mappings", "Apply mappings from file")
  .describe("securities", "Import roles, profiles and users from file")
  .describe("vault-key", "Vault key used to decrypt secrets")
  .describe("secrets-file", "Encrypted secrets file to decrypt at startup")
  .describe(
    "enable-plugins",
    'Enable plugins from "plugins/available" directory',
  ).argv as Record<string, unknown>;

const options: ServerOptions = {
  enablePlugins: stringOption(argv, "enablePlugins"),
  fixtures: stringOption(argv, "fixtures"),
  mappings: stringOption(argv, "mappings"),
  secretsFile: stringOption(argv, "secretsFile"),
  securities: stringOption(argv, "securities"),
  vaultKey: stringOption(argv, "vaultKey"),
};

const run = async (): Promise<void> => {
  try {
    await startKuzzle(options);
  } catch (error) {
    console.error(
      `[x] [ERROR] ${error instanceof Error ? error.stack : String(error)}`,
    );
    process.exit(1);
  }
};

run();

// Used for tests only
export = startKuzzle;
