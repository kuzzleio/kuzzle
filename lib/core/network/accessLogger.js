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

// winston is CPU-hungry: isolating it in a worker thread allows for a more
// efficient CPU resources management, and more performances in the end
const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("worker_threads");

const pino = require("pino");
const moment = require("moment");

const { KuzzleRequest } = require("../../api/request");

const ALLOWED_TRANSPORTS = ["console", "elasticsearch", "file", "syslog"];

class AccessLogger {
  constructor() {
    this.isActive = false;
    this.worker = null;
    this.logger = global.kuzzle.log.child("core:network:accessLogger");
  }

  async init() {
    const config = global.kuzzle.config.server;

    for (const out of config.logs.transports) {
      if (out.transport && !ALLOWED_TRANSPORTS.includes(out.transport)) {
        this.logger.error(
          `Failed to initialize logger transport "${out.transport}": unsupported transport. Skipped.`,
        );
      } else {
        this.isActive = this.isActive || !out.silent;
      }
    }

    if (!this.isActive) {
      return;
    }

    const anonymous = await global.kuzzle.ask(
      "core:security:user:anonymous:get",
    );
    this.worker = new Worker(__filename, {
      workerData: {
        anonymousUserId: anonymous._id,
        config,
        kuzzleId: global.nodeId,
      },
    });
  }

  log(connection, request, extra) {
    if (!this.isActive) {
      return;
    }

    const serialized = request.serialize();

    // Users can set anything in the request response, as long as it can
    // be stringified. Problem is: not all that can be stringified is
    // serializable to worker threads (e.g. functions).
    serialized.options.result = undefined;

    // Since we won't pass the response to the worker thread, we need to
    // compute its size beforehand, as this information is needed for access
    // logs
    const size = request.response
      ? Buffer.byteLength(JSON.stringify(request.response)).toString()
      : "-";

    extra = { ...extra, nodeId: global.nodeId };

    try {
      this.worker.postMessage({
        connection,
        extra,
        request: serialized,
        size,
      });
    } catch (error) {
      this.logger.error(
        `Failed to write access log for request "${request.id}": ${error.message}`,
      );
    }
  }
}

class AccessLoggerWorker {
  constructor(config, anonymousUserId) {
    this.config = config;
    this.logger = null;
    this.anonymousUserId = anonymousUserId;
  }

  init() {
    this.initTransport();

    parentPort.on("message", ({ connection, extra, request, size }) => {
      this.logAccess(
        connection,
        new KuzzleRequest(request.data, request.options),
        size,
        extra,
      );
    });
  }

  initTransport() {
    const transports = { targets: [] };

    for (const conf of this.config.logs.transports) {
      if (conf.silent === true) {
        continue;
      }

      // Guarantee default transport is 'console' and retro compatibility with winston options
      switch (conf.transport || conf.preset || "console") {
        case "console":
          transports.targets.push({
            options: {
              destination: 1,
            },
            target: "pino/file",
          });
          break;
        case "elasticsearch":
          transports.targets.push({
            options: Object.assign({}, conf.options),
            target: "pino-elasticsearch",
          });
          break;
        case "file":
          transports.targets.push({
            options: {
              append: conf.options.append ?? true,
              destination: conf.options.destination ?? "./kuzzle.access.log",
              mkdir: conf.options.mkdir ?? true,
            },
            target: "pino/file",
          });
          break;
        default:
        // do nothing
      }

      // If a pino transport configuration is used, we'll try to use it as-is and
      // assume the user installed the necessary dependencies in his Kuzzle application
      if (typeof conf.target === "string" && conf.target !== "") {
        transports.targets.push({
          options: conf.options || {},
          target: conf.target,
        });
      }
    }

    this.logger = pino(pino.transport(transports));
  }

  /**
   * @param {ClientConnection} connection
   * @param {Request} request
   * @param {String} size - response size, in bytes
   * @param {Object} [extra]
   */
  logAccess(connection, request, size, extra = null) {
    if (this.config.logs.accessLogFormat === "logstash") {
      // custom kuzzle logs to be exported to logstash
      this.logger.info({
        connection,
        error: request.error,
        extra,
        request: request.input,
        status: request.status,
      });
      return;
    }

    // user init: prioritize the already decoded and verified token stored in
    // the request
    // If not available, then that may mean that we didn't verify the user yet,
    // so we have to decode any provided token
    let user = null;

    if (request.context.token !== null) {
      user =
        request.context.token.userId === this.anonymousUserId
          ? "(anonymous)"
          : request.context.token.userId;
    }

    // = apache combined
    const protocol = connection.protocol.toUpperCase();
    let url;
    let verb = "DO";

    if (connection.protocol.indexOf("HTTP/") === 0) {
      verb = extra.method;
      url = extra.url;
    }
    // for other protocols than http, we rebuild a pseudo url
    else {
      url = `/${request.input.controller}/${request.input.action}`;

      if (request.input.args.index) {
        url += `/${request.input.args.index}`;
      }

      if (request.input.args.collection) {
        url += `/${request.input.args.collection}`;
      }

      if (request.input.args._id) {
        url += `/${request.input.args._id}`;
      }

      let queryString = "";

      for (const k of Object.keys(request.input.args)) {
        if (k === "_id" || k === "index" || k === "collection") {
          continue;
        }

        const val = request.input.args[k];

        if (queryString.length > 0) {
          queryString += "&";
        }

        queryString += `${k}=${
          typeof val === "object" ? JSON.stringify(val) : val
        }`;
      }

      if (queryString.length > 0) {
        url += `?${queryString}`;
      }
    }

    if (user === null) {
      user = "(unknown)";
    }

    const ip = this.getIP(connection);
    const when = moment().format("DD/MMM/YYYY:HH:mm:ss ZZ");
    const status = request.status || "-";
    const referer = connection.headers.referer
      ? `"${connection.headers.referer}"`
      : "-";
    const agent = connection.headers["user-agent"]
      ? `"${connection.headers["user-agent"]}"`
      : "-";

    this.logger.info(
      { namespace: "kuzzle:accessLogs", nodeId: extra.nodeId },
      `${ip} - ${user} [${when}] "${verb} ${url} ${protocol}" ${status} ${size} ${referer} ${agent}`,
    );
  }

  /**
   * @param  {ClientConnection} connection
   */
  getIP(connection) {
    const { ips } = connection;

    if (ips.length === 0) {
      return "-";
    }

    const idx = Math.max(
      0,
      ips.length - 1 - this.config.logs.accessLogIpOffset,
    );

    return ips[idx];
  }
}

if (!isMainThread) {
  // Needed for instantiating a serialized KuzzleRequest object
  global.kuzzle = { id: workerData.kuzzleId };

  const worker = new AccessLoggerWorker(
    workerData.config,
    workerData.anonymousUserId,
  );

  worker.init();
}

// Exposing the worker isn't necessary for production code: this is only
// useful to make this class testable. I usually don't like it when tests have a
// say in how the code should be written, but in this particular case, I see
// no other way to correctly test this.
module.exports = { AccessLogger, AccessLoggerWorker };
