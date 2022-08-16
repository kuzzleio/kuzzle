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

const { formatWithOptions } = require("util");

const { Client } = require("@elastic/elasticsearch");
const validator = require("validator");
const _ = require("lodash");

const ConnectorContext = require("../lib/connectorContext");

let promise = null;

async function getEsClient(context) {
  const currentConfiguration = _.get(
    context.config,
    "services.storageEngine.client"
  );

  if (!currentConfiguration) {
    context.log.error("Missing Kuzzle configuration for Elasticsearch.");
    context.log.error(
      "Missing configuration value: services.storageEngine.client"
    );
    context.log.error("Aborted.");
    process.exit(1);
  }

  context.log.notice("Current Elasticsearch configuration:");
  context.log.print(
    formatWithOptions({ colors: false, depth: null }, currentConfiguration)
  );

  const answers = await context.inquire.prompt([
    {
      choices: ["source", "target", "source and target"],
      default: "target",
      message: "For this migration, use this current instance as the data",
      name: "current",
      type: "list",
    },
    {
      default: "",
      message: ({ current }) =>
        `Enter the URL for the ${
          current === "source" ? "target" : "source"
        } instance:`,
      name: "url",
      type: "input",
      validate: (url) => {
        const opts = {
          protocols: ["http", "https"],
          require_port: true,
          require_protocol: true,
          require_tld: false,
          require_valid_protocol: true,
        };

        return (
          validator.isURL(url, opts) ||
          "A valid URL must be provided. Example: http://<server>:<port>"
        );
      },
      when: ({ current }) => current !== "source and target",
    },
  ]);

  const current = new Client(currentConfiguration);
  const next = answers.url ? new Client({ node: answers.url }) : current;

  return answers.current === "source"
    ? new ConnectorContext(context, current, next)
    : new ConnectorContext(context, next, current);
}

module.exports = async (context) => {
  if (promise === null) {
    promise = getEsClient(context);
  }

  return promise;
};
