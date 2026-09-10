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

/**
 * Second half of `npm run build`: `tsc` emits the compiled JavaScript, this
 * copies into `dist/` what the compiler does not — the cluster's `.proto`
 * definitions and the executable server entrypoint.
 *
 * Run from the source tree (`npx tsx ./bin/copy-binaries.ts`), not from
 * `dist/`, so the paths below stay relative to the repository root.
 */

import * as fs from "fs/promises";
import * as path from "path";

async function main(): Promise<void> {
  const projectRoot = path.join(__dirname, "..");
  const protobufSourceDir = path.join(
    projectRoot,
    "lib",
    "cluster",
    "protobuf",
  );
  const protobufTargetDir = path.join(
    projectRoot,
    "dist",
    "lib",
    "cluster",
    "protobuf",
  );
  const binSourceFile = path.join(projectRoot, "bin", "start-kuzzle-server");
  const binTargetDir = path.join(projectRoot, "dist", "bin");
  const binTargetFile = path.join(binTargetDir, "start-kuzzle-server");

  await fs.mkdir(protobufTargetDir, { recursive: true });
  await fs.cp(protobufSourceDir, protobufTargetDir, { recursive: true });

  await fs.mkdir(binTargetDir, { recursive: true });
  await fs.copyFile(binSourceFile, binTargetFile);
  await fs.chmod(binTargetFile, 0o755);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to copy protobuf definitions:", error);
  process.exit(1);
});
