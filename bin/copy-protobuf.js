#!/usr/bin/env node

"use strict";

const fs = require("fs/promises");
const path = require("path");

async function main() {
  const projectRoot = path.join(__dirname, "..");
  const sourceDir = path.join(projectRoot, "lib", "cluster", "protobuf");
  const targetDir = path.join(
    projectRoot,
    "dist",
    "lib",
    "cluster",
    "protobuf",
  );

  await fs.mkdir(targetDir, { recursive: true });
  await fs.cp(sourceDir, targetDir, { recursive: true });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to copy protobuf definitions:", error);
  process.exit(1);
});
