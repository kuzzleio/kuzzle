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

import { flatten, uniq } from "lodash";
import { Redis as IORedis, Cluster as IOCluster } from "ioredis";
import Service from "../service";

import { wrap } from "../../kerror";
const kerror = wrap("services", "cache");

/**
 * @class Redis
 * @extends Service
 * @param {object} config
 * @property service
 */
class Redis extends Service {
  public connected: boolean;
  public client!: IORedis | IOCluster; // Will be assigned in the initSequence
  public commands: IORedis;
  public adapterName: string;
  public logger: any;

  constructor(config: any, name: string) {
    super("redis", config);

    this.connected = false;
    this.commands = {} as IORedis;
    this.adapterName = name;

    this.logger = global.kuzzle.log.child // It means we're in the main Kuzzle process
      ? global.kuzzle.log.child("services:cache:redis")
      : global.kuzzle.log;
  }

  /**
   * Initialize the redis client, select the service associated database and
   * flush it to make sure we start from a clean state
   *
   * @returns {Promise}
   */
  override _initSequence(): Promise<void> {
    const config = JSON.parse(JSON.stringify(this._config));

    // Only way to connect to AWS ELastiCache
    // https://github.com/luin/ioredis#special-note-aws-elasticache-clusters-with-tls
    if (config.overrideDnsLookup) {
      config.clusterOptions.dnsLookup = (
        address: string,
        callback: (err: any, address: string) => void,
      ) => callback(null, address);
    }

    config.options = config.options || {};
    if (config.pingKeepAlive && config.pingKeepAlive > 0) {
      config.options.pingInterval = config.pingKeepAlive;
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

    this.client.on("error", (error: Error) => {
      if (this.connected) {
        global.kuzzle.log.error(
          `Redis service seem to be down, see original error for more info:\n${error.message}`,
        );
      }
      this.connected = false;
    });

    this.setCommands();

    return new Promise((resolve, reject) => {
      this.client.once("ready", async () => {
        await this.client.client(
          "SETNAME",
          `${this.adapterName}/${global.kuzzle.id}`,
        );
        resolve();
      });

      this.client.once("error", (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Initializes the Redis commands list, and add transformers when necessary
   */
  setCommands(): void {
    const commandsList = this.client.getBuiltinCommands();

    for (const command of commandsList) {
      (this.commands as any)[command] = async (...args: any[]) => {
        if (!this.connected) {
          throw kerror.get("notconnected");
        }

        return (this.client as any)[command](...args);
      };
    }
  }

  /**
   * Return some basic information about this service
   * @override
   *
   * @returns {Promise} service informations
   */
  override async info(): Promise<any> {
    const result = await this.commands.info();
    const arr = result.replace(/\r\n/g, "\n").split("\n");
    const info: Record<string, string> = {};

    for (const elt of arr) {
      const item = elt.trim();
      if (item.length > 0 && !item.startsWith("#")) {
        const [key, value] = item.split(":");
        if (key !== undefined && value !== undefined) {
          info[key] = value;
        }
      }
    }

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
   * @returns {Promise.<string[]>} promise resolving to an array of keys
   */
  async searchKeys(pattern: string): Promise<string[]> {
    if (this.client instanceof IOCluster) {
      const keys = await Promise.all(
        this.client.nodes("master").map((node: any) => {
          return this._searchNodeKeys(node, pattern);
        }),
      );

      return uniq(flatten(keys));
    }

    return this._searchNodeKeys(this.client, pattern);
  }

  /**
   * Executes multiple client commands in a single action
   *
   * @returns {Promise}
   */
  async mExecute(commands: any[]): Promise<any> {
    if (!Array.isArray(commands) || commands.length === 0) {
      return [];
    }

    return this.client.multi(commands).exec();
  }

  _searchNodeKeys(node: any, pattern: string): Promise<string[]> {
    return new Promise((resolve) => {
      let keys: string[] = [];
      const stream = node.scanStream({ match: pattern });

      stream.on("data", (resultKeys: string[]) => {
        keys = keys.concat(resultKeys);
      });

      stream.on("end", () => {
        resolve(uniq(keys));
      });
    });
  }

  _buildClient(options: any): IORedis {
    return new IORedis({ ...(this as any)._config.node, ...options });
  }

  _buildClusterClient(options: any): IOCluster {
    return new IORedis.Cluster((this as any)._config.nodes, options);
  }

  /**
   * Convenience method: set a key and its value
   *
   * Options:
   *   - onlyIfNew: if true, set the NX option
   *   - ttl: if true, set the PX option
   *
   * @param  {string} key
   * @param  {string} value
   * @param  {{onlyIfNew: boolean, ttl: number}} [options]
   * @return {boolean} true if the key was set, false otherwise
   */
  async store(
    key: string,
    value: string,
    { onlyIfNew = false, ttl = 0 }: { onlyIfNew?: boolean; ttl?: number } = {},
  ): Promise<boolean> {
    const command: any[] = [key, value];

    if (onlyIfNew) {
      command.push("NX");
    }

    if (ttl > 0) {
      command.push("PX", ttl);
    }

    const result = await (this.commands as any).set(...command);

    return result === "OK";
  }

  /**
   * Executes a client command
   * @param  {string} command
   * @param  {Array} args
   * @return {Promise.<*>}
   */
  exec(command: string, ...args: any[]): Promise<any> {
    return (this.commands as any)[command](...args);
  }
}

export = Redis;
