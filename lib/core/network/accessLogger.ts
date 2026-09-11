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

// winston is CPU-hungry: isolating it in a worker thread allows for a more
// efficient CPU resources management, and more performances in the end
import {
  isMainThread,
  parentPort,
  Worker,
  workerData,
} from "node:worker_threads";

import moment from "moment";
import * as pino from "pino";

import { KuzzleRequest } from "../../api/request";
import { Kuzzle } from "../../kuzzle";
import { ServerConfiguration } from "../../types";
import type ClientConnection from "./clientConnection";

const ALLOWED_TRANSPORTS = new Set([
  "console",
  "elasticsearch",
  "file",
  "syslog",
]);

/** What a protocol adds to an HTTP access log line */
interface AccessLogExtra {
  method: string;
  url: string;
}

class AccessLogger {
  public isActive = false;
  public worker: Worker | null = null;

  private readonly logger = global.kuzzle.log.child(
    "core:network:accessLogger",
  );

  async init(): Promise<void> {
    const config = global.kuzzle.config.server;

    for (const out of config.logs.transports) {
      if (out.transport && !ALLOWED_TRANSPORTS.has(out.transport)) {
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

  log(
    connection: ClientConnection,
    request: KuzzleRequest,
    extra?: AccessLogExtra | null,
  ): void {
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

    try {
      this.worker.postMessage({
        connection,
        extra,
        request: serialized,
        size,
      });
    } catch (error) {
      this.logger.error(
        `Failed to write access log for request "${request.id}": ${
          (error as Error).message
        }`,
      );
    }
  }
}

class AccessLoggerWorker {
  public config: ServerConfiguration;
  public logger: pino.Logger | null;
  public anonymousUserId: string;

  constructor(config: ServerConfiguration, anonymousUserId: string) {
    this.config = config;
    this.logger = null;
    this.anonymousUserId = anonymousUserId;
  }

  init(): void {
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

  initTransport(): void {
    const targets: pino.TransportTargetOptions[] = [];

    for (const conf of this.config.logs.transports) {
      if (conf.silent === true) {
        continue;
      }

      // Guarantee default transport is 'console' and retro compatibility with winston options
      switch (conf.transport || conf.preset || "console") {
        case "console":
          targets.push({
            level: conf.level || "info",
            options: {
              destination: 1,
            },
            target: "pino/file",
          });
          break;
        case "elasticsearch":
          targets.push({
            level: conf.level || "info",
            options: { ...conf.options },
            target: "pino-elasticsearch",
          });
          break;
        case "file":
          targets.push({
            level: conf.level || "info",
            options: {
              append: conf.options?.append ?? true,
              destination: conf.options?.destination ?? "./kuzzle.access.log",
              mkdir: conf.options?.mkdir ?? true,
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
        targets.push({
          level: conf.level || "info",
          options: conf.options || {},
          target: conf.target,
        });
      }
    }

    this.logger = pino.pino(pino.transport({ targets }));
  }

  /**
   * @param size - response size, in bytes
   */
  logAccess(
    connection: ClientConnection,
    request: KuzzleRequest,
    size: string,
    extra: AccessLogExtra | null = null,
  ): void {
    if (this.config.logs.accessLogFormat === "logstash") {
      // custom kuzzle logs to be exported to logstash
      this.logger.info({
        connection,
        error: request.error,
        extra,
        namespace: "kuzzle:accessLogs",
        nodeId: global.kuzzle.id,
        request: request.input,
        status: request.status,
      });
      return;
    }

    const user = this.resolveUser(request);

    // = apache combined
    const protocol = connection.protocol.toUpperCase();
    let url;
    let verb = "DO";

    if (connection.protocol.startsWith("HTTP/")) {
      verb = extra.method;
      url = extra.url;
    }
    // for other protocols than http, we rebuild a pseudo url
    else {
      url = buildPseudoUrl(request);
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
      { namespace: "kuzzle:accessLogs", nodeId: global.kuzzle.id },
      `${ip} - ${user} [${when}] "${verb} ${url} ${protocol}" ${status} ${size} ${referer} ${agent}`,
    );
  }

  /**
   * The user the access log line is attributed to: the already decoded and
   * verified token stored in the request is preferred; without one, we have no
   * verified identity to report.
   */
  private resolveUser(request: KuzzleRequest): string {
    const { token } = request.context;

    if (token === null) {
      return "(unknown)";
    }

    const user =
      token.userId === this.anonymousUserId ? "(anonymous)" : token.userId;

    return user === null ? "(unknown)" : user;
  }

  getIP(connection: ClientConnection): string {
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

/**
 * For protocols other than http, we rebuild a pseudo url out of the request's
 * controller, action and arguments.
 */
function buildPseudoUrl(request: KuzzleRequest): string {
  let url = `/${request.input.controller}/${request.input.action}`;

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

    queryString += `${k}=${typeof val === "object" ? JSON.stringify(val) : val}`;
  }

  if (queryString.length > 0) {
    url += `?${queryString}`;
  }

  return url;
}

if (!isMainThread) {
  // Needed for instantiating a serialized KuzzleRequest object: the worker
  // thread has no Kuzzle instance of its own, only the node id.
  global.kuzzle = { id: workerData.kuzzleId } as Kuzzle;

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
export { AccessLogger, AccessLoggerWorker };
