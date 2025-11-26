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

module.exports = {
  default: defaultConfig,

  http: {
    ...httpConfig,
    ...defaultConfig,
  },

  mqtt: {
    ...mqttConfig,
    ...defaultConfig,
  },

  websocket: {
    ...websocketConfig,
    ...defaultConfig,
  },
};
