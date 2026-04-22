#!/usr/bin/env node

"use strict";

const fs = require("fs/promises");
const path = require("path");

async function main() {
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
