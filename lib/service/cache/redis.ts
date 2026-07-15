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

import Bluebird from "bluebird";
import { Redis as IORedis, Cluster } from "ioredis";
import type { RedisOptions, ClusterOptions } from "ioredis";
import { JSONObject } from "kuzzle-sdk";

import * as kerror from "../../kerror";
import Service from "../service";

const cacheError = kerror.wrap("services", "cache");

/**
 * A single-command forwarder, bound to a Redis command name.
 */
type RedisCommand = (...args: unknown[]) => Promise<unknown>;

/**
 * @class Redis
 * @extends Service
 */
class Redis extends Service {
  public connected: boolean;
  public client: IORedis | Cluster | null;
  public commands: Record<string, RedisCommand>;
  public adapterName: string;
  public pingIntervalID: NodeJS.Timeout | null;
  public logger: unknown;

  constructor(config: JSONObject, name?: string) {
    super("redis", config);

    this.connected = false;
    this.client = null;
    this.commands = {};
    this.adapterName = name;
    this.pingIntervalID = null;

    this.logger = global.kuzzle.log.child // It means we're in the main Kuzzle process
      ? global.kuzzle.log.child("services:cache:redis")
      : global.kuzzle.log;
  }

  /**
   * Initialize the redis client, select the service associated database and
   * flush it to make sure we start from a clean state
   */
  _initSequence(): Promise<void> {
    const config = structuredClone(this._config);

    // Only way to connect to AWS ELastiCache
    // https://github.com/luin/ioredis#special-note-aws-elasticache-clusters-with-tls
    if (config.overrideDnsLookup) {
      config.clusterOptions.dnsLookup = (address, callback) =>
        callback(null, address);
    }

    if (config.nodes) {
      this.client = this._buildClusterClient({
        ...config.clusterOptions,
        redisOptions: config.options,
      });
    } else {
      this.client = this._buildClient(config.options);
    }

    this.client.on("ready", () => {
      this.connected = true;
    });

    this.client.on("error", (error) => {
      if (this.connected) {
        global.kuzzle.log.error(
          `Redis service seem to be down, see original error for more info:\n${error.message}`,
        );
      }
      this.connected = false;
    });

    this.setCommands();
    // TODO: Remove this when IORedis does support application level pings to keep connection to Azure Redis alive
    if (config.pingKeepAlive && config.pingKeepAlive > 0) {
      this._setupKeepAlive(config.pingKeepAlive);
    }

    return new Bluebird<void>((resolve, reject) => {
      this.client.once("ready", async () => {
        await this.client.client(
          "SETNAME",
          `${this.adapterName}/${global.kuzzle.id}`,
        );
        resolve();
      });

      this.client.once("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Setup a ping interval to keep the connection alive
   * Every 60 seconds a ping is sent to Redis
   */
  _setupKeepAlive(delay: number): void {
    this.client.on("ready", async () => {
      await this._ping();
      this.pingIntervalID = setInterval(this._ping.bind(this), delay);
    });

    this.client.on("error", () => {
      clearInterval(this.pingIntervalID);
      this.pingIntervalID = null;
    });
  }

  /**
   * Ping Redis
   */
  async _ping(): Promise<void> {
    try {
      await this.client.ping();
    } catch (error) {
      global.kuzzle.log.error(
        `Failed to PING Redis to keep connection alive:\n${error.message}`,
      );
    }
  }

  /**
   * Initializes the Redis commands list, and add transformers when necessary
   */
  setCommands(): void {
    const commandsList = this.client.getBuiltinCommands();

    for (const command of commandsList) {
      this.commands[command] = async (...args: unknown[]) => {
        if (!this.connected) {
          throw cacheError.get("notconnected");
        }

        return (this.client as unknown as Record<string, RedisCommand>)[
          command
        ](...args);
      };
    }
  }

  /**
   * Return some basic information about this service
   * @override
   */
  async info(): Promise<JSONObject> {
    const result = (await this.commands.info()) as string;
    const arr = result.replaceAll("\r\n", "\n").split("\n");
    const info: Record<string, string> = {};

    arr.forEach((item) => {
      item = item.trim();
      if (item.length > 0 && !item.startsWith("#")) {
        const keyValuePair = item.split(":");
        info[keyValuePair[0]] = keyValuePair[1];
      }
    });

    return {
      memoryPeak: info.used_memory_peak_human,
      memoryUsed: info.used_memory_human,
      mode: info.redis_mode,
      type: "redis",
      version: info.redis_version,
    };
  }

  /**
   * Returns all the keys matching a given pattern.
   *
   * /!\ We don't use `keys` to avoid blocking Redis if using a big dataset
   * cf: http://redis.io/commands/keys
   *     and http://redis.io/commands/scan
   *
   * @param pattern
   * @returns promise resolving to an array of keys
   */
  async searchKeys(pattern: string): Promise<string[]> {
    if (this.client instanceof Cluster) {
      const keys = await Bluebird.map(this.client.nodes("master"), (node) => {
        return this._searchNodeKeys(node, pattern);
      });

      return [...new Set(keys.flat())];
    }

    return this._searchNodeKeys(this.client, pattern);
  }

  /**
   * Executes multiple client commands in a single action
   */
  mExecute(commands: unknown[]): Promise<unknown> {
    if (!Array.isArray(commands) || commands.length === 0) {
      return Bluebird.resolve([]);
    }

    return this.client.multi(commands as unknown[][]).exec();
  }

  _searchNodeKeys(node: IORedis, pattern: string): Promise<string[]> {
    return new Bluebird<string[]>((resolve) => {
      let keys: string[] = [];
      const stream = node.scanStream({ match: pattern });

      stream.on("data", (resultKeys: string[]) => {
        keys = keys.concat(resultKeys);
      });

      stream.on("end", () => {
        resolve([...new Set(keys)]);
      });
    });
  }

  _buildClient(options: RedisOptions): IORedis {
    return new IORedis({ ...this._config.node, ...options });
  }

  _buildClusterClient(options: ClusterOptions): Cluster {
    return new Cluster(this._config.nodes, options);
  }

  /**
   * Convenience method: set a key and its value
   *
   * Options:
   *   - onlyIfNew: if true, set the NX option
   *   - ttl: if true, set the PX option
   *
   * @param key
   * @param value
   * @param options
   * @returns true if the key was set, false otherwise
   */
  async store(
    key: string,
    value: string,
    { onlyIfNew = false, ttl = 0 }: { onlyIfNew?: boolean; ttl?: number } = {},
  ): Promise<boolean> {
    const command: Array<string | number> = [key, value];

    if (onlyIfNew) {
      command.push("NX");
    }

    if (ttl > 0) {
      command.push("PX", ttl);
    }

    const result = await this.commands.set(...command);

    return result === "OK";
  }

  /**
   * Executes a client command
   */
  exec(command: string, ...args: unknown[]): Promise<unknown> {
    return this.commands[command](...args);
  }
}

export = Redis;
