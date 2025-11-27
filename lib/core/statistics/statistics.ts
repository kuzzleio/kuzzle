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

import { Request, RequestContext } from "../../api/request";
import * as kerror from "../../kerror";
import { Logger } from "../../kuzzle/Logger";

const errorApiAssert = kerror.wrap("api", "assert");
const errorStats = kerror.wrap("services", "stats");

type StatsMaps = {
  completedRequests: Map<string, number>;
  connections: Map<string, number>;
  failedRequests: Map<string, number>;
  ongoingRequests: Map<string, number>;
};

type SerializableStats = {
  completedRequests: Record<string, number>;
  connections: Record<string, number>;
  failedRequests: Record<string, number>;
  ongoingRequests: Record<string, number>;
};

type StatsFrame = SerializableStats & { timestamp: number };
type StatsResponse = { hits: StatsFrame[]; total: number };
type LastStatsResponse = StatsFrame | (StatsMaps & { timestamp: number });

/**
 * @class Statistics
 * @param {Kuzzle} kuzzle
 */
export default class Statistics {
  // braces force all stats keys onto a single Redis slot in cluster mode
  private cacheKeyPrefix = "{stats/}";

  public enabled: boolean;
  public ttl: number;
  public interval: number;
  public lastFrame: number | null;
  public timer: NodeJS.Timeout | null;

  public currentStats: StatsMaps;

  private readonly logger: Logger;

  constructor() {
    this.enabled = global.kuzzle.config.stats.enabled;
    this.ttl = global.kuzzle.config.stats.ttl * 1000;
    this.interval = global.kuzzle.config.stats.statsInterval * 1000;
    this.lastFrame = null;
    this.timer = null;

    this.currentStats = {
      completedRequests: new Map<string, number>(),
      connections: new Map<string, number>(),
      failedRequests: new Map<string, number>(),
      ongoingRequests: new Map<string, number>(),
    };

    this.logger = global.kuzzle.log.child("core:statistics");
  }

  /**
   * Start recording a new request
   *
   * @param {Request} request
   */
  startRequest(request?: Request): void {
    if (!this.enabled) {
      return;
    }

    const protocol = request?.context.connection.protocol;

    if (!protocol) {
      return;
    }

    const ongoing = this.currentStats.ongoingRequests;

    ongoing.set(protocol, (ongoing.get(protocol) || 0) + 1);
  }

  /**
   * Mark an ongoing request as 'completed'
   *
   * @param {Request} request
   */
  completedRequest(request?: Request): void {
    if (!this.enabled) {
      return;
    }

    const protocol = request?.context.connection.protocol;

    if (!protocol) {
      return;
    }

    const ongoing = this.currentStats.ongoingRequests;
    const currentOngoing = ongoing.get(protocol) || 0;

    ongoing.set(protocol, currentOngoing - 1);

    const completed = this.currentStats.completedRequests;

    completed.set(protocol, (completed.get(protocol) || 0) + 1);
  }

  /**
   * Mark an ongoing request as 'completed'
   *
   * @param {Request} request
   */
  failedRequest(request?: Request): void {
    if (!this.enabled) {
      return;
    }

    const protocol = request?.context.connection.protocol;

    if (!protocol) {
      return;
    }

    const ongoing = this.currentStats.ongoingRequests;
    const currentOngoing = ongoing.get(protocol) || 0;

    ongoing.set(protocol, currentOngoing - 1);

    const failed = this.currentStats.failedRequests;

    failed.set(protocol, (failed.get(protocol) || 0) + 1);
  }

  /**
   * Register a newly created connection
   *
   * @param {RequestContext} requestContext
   */
  newConnection(requestContext: RequestContext): void {
    if (!this.enabled) {
      return;
    }

    const protocol = requestContext.connection.protocol;

    if (!protocol) {
      return;
    }

    const connections = this.currentStats.connections;

    connections.set(protocol, (connections.get(protocol) || 0) + 1);
  }

  /**
   * Removes a connection from the statistics
   *
   * @param {RequestContext} requestContext
   */
  dropConnection(requestContext: RequestContext): void {
    if (!this.enabled) {
      return;
    }

    const protocol = requestContext.connection.protocol;

    if (!protocol) {
      return;
    }

    const connections = this.currentStats.connections;
    const currentConnections = connections.get(protocol);

    if (currentConnections === undefined) {
      return;
    }

    if (currentConnections === 1) {
      connections.delete(protocol);
    } else {
      connections.set(protocol, currentConnections - 1);
    }
  }

  /**
   * Gets stored statistics frames from a date
   *
   * @returns {Promise}
   */
  async getLastStats(): Promise<LastStatsResponse> {
    if (!this.enabled) {
      throw errorStats.get("not_available");
    }

    const frame: LastStatsResponse = Object.assign(
      { timestamp: Date.now() },
      this.currentStats,
    );

    if (!this.lastFrame) {
      return frame;
    }

    const last = await global.kuzzle.ask(
      "core:cache:internal:get",
      this.cacheKeyPrefix + this.lastFrame,
    );

    return Object.assign(frame, JSON.parse(last)) as LastStatsResponse;
  }

  /**
   * Gets the last saved statistics frame from a date
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getStats(request?: Request): Promise<StatsResponse> {
    if (!this.enabled) {
      throw errorStats.get("not_available");
    }

    const response: StatsResponse = {
      hits: [],
      total: 0,
    };
    const currentDate = Date.now();
    let startTime: number | undefined;
    let stopTime: number | undefined;

    if (request?.input.args?.startTime) {
      startTime = isNaN(request.input.args.startTime)
        ? new Date(request.input.args.startTime).getTime()
        : request.input.args.startTime;
    }

    if (request?.input.args?.stopTime) {
      stopTime = isNaN(request.input.args.stopTime)
        ? new Date(request.input.args.stopTime).getTime()
        : request.input.args.stopTime;
    }

    if (startTime !== undefined && isNaN(startTime)) {
      throw errorApiAssert.get("invalid_argument", "startTime", "number");
    }

    if (stopTime !== undefined && isNaN(stopTime)) {
      throw errorApiAssert.get("invalid_argument", "stopTime", "number");
    }

    if (startTime !== undefined && startTime >= currentDate) {
      response.total = response.hits.length;
      return response;
    }

    const stats = {
      completedRequests: Object.fromEntries(
        this.currentStats.completedRequests,
      ),
      connections: Object.fromEntries(this.currentStats.connections),
      failedRequests: Object.fromEntries(this.currentStats.failedRequests),
      ongoingRequests: Object.fromEntries(this.currentStats.ongoingRequests),
    };

    if (!this.lastFrame) {
      if (!stopTime || stopTime >= currentDate) {
        response.hits.push(Object.assign({ timestamp: currentDate }, stats));
      }

      response.total = response.hits.length;

      return response;
    }

    const frames = await global.kuzzle.ask(
      "core:cache:internal:searchKeys",
      `${this.cacheKeyPrefix}*`,
    );

    const regex = new RegExp(`^${this.cacheKeyPrefix}`);

    // Statistics keys are timestamp.
    // Ordering them guarantees stats frames to be returned in the right order
    const values = await global.kuzzle.ask(
      "core:cache:internal:mget",
      frames.sort(),
    );

    values.forEach((v, idx) => {
      const frameDateTime = Number(frames[idx].replace(regex, ""));

      if (
        (!startTime || startTime <= frameDateTime) &&
        (!stopTime || stopTime >= frameDateTime)
      ) {
        response.hits.push(
          Object.assign(JSON.parse(v), {
            timestamp: frameDateTime,
          }) as StatsFrame,
        );
      }
    });

    response.total = response.hits.length;

    return response;
  }

  /**
   * Gets all the saved statistics
   *
   * @returns {Promise<Object>}
   */
  getAllStats(): Promise<StatsResponse> {
    return this.getStats();
  }

  /**
   * Init statistics component
   */
  init(): void {
    if (!this.enabled) {
      return;
    }

    this.timer = setInterval(async () => {
      try {
        await this.writeStats();
      } catch (error) {
        this.logger.error(`Cannot write stats frame: ${error}`);
      }
    }, this.interval);

    global.kuzzle.on("core:cache:internal:flushdb", (): void => {
      this.lastFrame = null;
    });
  }

  async writeStats(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const stats = JSON.stringify(this.currentStats);

    this.lastFrame = Date.now();
    this.currentStats.completedRequests = new Map<string, number>();
    this.currentStats.failedRequests = new Map<string, number>();

    await global.kuzzle.ask(
      "core:cache:internal:store",
      this.cacheKeyPrefix + this.lastFrame,
      stats,
      { ttl: this.ttl },
    );
  }
}
