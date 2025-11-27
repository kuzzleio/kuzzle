"use strict";

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
