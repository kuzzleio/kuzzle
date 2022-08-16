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

"use strict";

const { formatWithOptions } = require("util"),
  IORedis = require("ioredis"),
  ConnectorContext = require("../lib/connectorContext"),
  _ = require("lodash");

let promise = null;

async function getRedisClient(context) {
  const currentConfiguration = _.get(context.config, "services.internalCache");

  if (!currentConfiguration) {
    context.log.error("Missing Kuzzle configuration for Redis.");
    context.log.error("Missing configuration value: services.internalCache");
    context.log.error("Aborted.");
    process.exit(1);
  }

  context.log.notice("Current Redis configuration:");
  context.log.print(
    formatWithOptions({ colors: false, depth: null }, currentConfiguration)
  );

  const current = await context.inquire.direct({
    choices: ["source", "target", "source and target"],
    default: "target",
    message: "For this migration, use this current instance as the data",
    type: "list",
  });

  const remaining = current === "source" ? "target" : "source";
  let answers = null;

  if (current !== "source and target") {
    answers = await context.inquire.prompt([
      {
        default: "",
        message: `${remaining} server name or IP:`,
        name: "server",
        type: "input",
        validate: (name) => name.length > 0 || "Non-empty string expected",
      },
      {
        default: "",
        message: `${remaining} server port:`,
        name: "port",
        type: "input",
        validate: (name) => {
          const i = Number.parseFloat(name);

          if (!Number.isNaN(i) && Number.isInteger(i) && i > 1 && i <= 65535) {
            return true;
          }

          return "Invalid port number";
        },
      },
    ]);
  }

  const options = { enableReadyCheck: true, lazyConnect: true },
    client = currentConfiguration.nodes
      ? new IORedis.Cluster(currentConfiguration, options)
      : new IORedis(currentConfiguration.node, options);

  await client.connect();

  let next;

  if (answers) {
    next = new IORedis(answers.port, answers.server, options);
    await next.connect();
  } else {
    next = client;
  }

  return current === "source"
    ? new ConnectorContext(context, client, next)
    : new ConnectorContext(context, next, client);
}

module.exports = async (context) => {
  if (promise === null) {
    promise = getRedisClient(context);
  }

  return promise;
};
