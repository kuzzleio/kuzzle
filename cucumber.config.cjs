"use strict";

// `requireModule: ["ts-node/register"]` below type-checks the step definitions as it
// loads them, and ts-node reads `tsconfig.json` unless told otherwise. Since the strict
// flip (docs/adr-001/steps/12-sprint-9-strict-flip.md, K6) that file is the PRODUCTION
// program — `strict: true`, and `features/` not even in its `include`. Pointing ts-node
// at a test program is what keeps the step definitions compiling under the settings they
// were written for; without it every functional shard dies at load time on a strict error
// in a step definition, with Kuzzle itself perfectly healthy.
//
// It points at `tsconfig.cucumber.json` rather than at `tsconfig.tests.json` directly:
// ts-node reads a project's `compilerOptions` but not its `include`, and since step 14's
// M7 left one strict test program, `noImplicitAny` is on here too — so the ambient
// declarations under `tests/types/` have to reach ts-node by another route. That file
// extends the test program and adds them. See its own comment.
process.env.TS_NODE_PROJECT =
  process.env.TS_NODE_PROJECT ||
  require("path").join(__dirname, "tsconfig.cucumber.json");

/** @type {import('@cucumber/cucumber').IConfiguration} */
const defaultConfig = {
  failFast: true,
  paths: ["features/**/*.feature"],
  publishQuiet: true,
  require: ["features/**/*.ts"],
  requireModule: ["ts-node/register"],
};

/** @type {import('@cucumber/cucumber').IConfiguration} */
const httpConfig = {
  tags: "not @realtime",
  worldParameters: {
    port: 7512,
    protocol: "http",
  },
};

/** @type {import('@cucumber/cucumber').IConfiguration} */
const mqttConfig = {
  tags: "not @http",
  worldParameters: {
    port: 7512,
    protocol: "mqtt",
  },
};

/** @type {import('@cucumber/cucumber').IConfiguration} */
const websocketConfig = {
  tags: "not @http",
  worldParameters: {
    port: 7512,
    protocol: "websocket",
  },
};

/** @type {import('@cucumber/cucumber').IConfiguration} */
const defaultLegacyConfig = {
  failFast: true,
  paths: ["features-legacy/**/*.feature"],
  publishQuiet: true,
  require: [
    "features-legacy/support/**/*.ts",
    "features-legacy/step_definitions/**/*.ts",
  ],
  requireModule: ["ts-node/register"],
};

module.exports = {
  default: defaultConfig,

  defaultLegacy: defaultLegacyConfig,

  http: {
    ...httpConfig,
    ...defaultConfig,
  },

  httpLegacy: {
    ...httpConfig,
    ...defaultLegacyConfig,
  },

  mqtt: {
    ...mqttConfig,
    ...defaultConfig,
  },

  mqttLegacy: {
    ...mqttConfig,
    ...defaultLegacyConfig,
  },

  websocket: {
    ...websocketConfig,
    ...defaultConfig,
  },

  websocketLegacy: {
    ...websocketConfig,
    ...defaultLegacyConfig,
  },
};
