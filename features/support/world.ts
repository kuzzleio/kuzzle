import type { DataTable, IWorldOptions } from "@cucumber/cucumber";
import {
  setDefaultTimeout,
  setWorldConstructor,
  World,
} from "@cucumber/cucumber";
import { Kuzzle, WebSocket, Http } from "kuzzle-sdk";

import { loadConfig } from "../../lib/config";

import "./assertions";

export default class KuzzleWorld extends World {
  private _sdk: Kuzzle;
  private _host: string;
  private _port: string;
  private _protocol: string;
  public readonly kuzzleConfig: ReturnType<typeof loadConfig>;
  public readonly props: Record<string, any>;

  constructor(options: IWorldOptions) {
    super(options);

    this._host = process.env.KUZZLE_HOST || "localhost";
    this._port = process.env.KUZZLE_PORT || "7512";
    this._protocol = process.env.KUZZLE_PROTOCOL || "websocket";

    this.kuzzleConfig = loadConfig();

    // Intermediate steps should store values inside this object
    this.props = {};

    this._sdk = this.getSDK();
  }

  get sdk() {
    return this._sdk;
  }

  get host() {
    return this._host;
  }

  get port() {
    return this._port;
  }

  get protocol() {
    return this._protocol;
  }

  parseObject(dataTable: DataTable): Record<string, unknown> {
    if (typeof dataTable.rowsHash !== "function") {
      throw new Error("Argument is not a dataTable");
    }

    // `rowsHash()` answers strings; every one of them is then evaluated, so the
    // result is a different type from its source and needs its own object —
    // writing the evaluated value back into `content` is what made this `any`.
    const content = dataTable.rowsHash();
    const parsed: Record<string, unknown> = {};

    for (const key of Object.keys(content)) {
      // eslint-disable-next-line no-eval
      parsed[key] = eval(`const o = ${content[key]}; o`);
    }

    return parsed;
  }

  parseObjectArray(dataTable: DataTable): Array<Record<string, unknown>> {
    if (typeof dataTable.rowsHash !== "function") {
      throw new Error("Argument is not a dataTable");
    }

    const objectArray: Array<Record<string, unknown>> = [];
    // `raw()`, not `rawTable`: the latter is private, and reaching a private
    // binding means the caller was written against an implementation detail —
    // step 13's L6 rule. `raw()` is the public reader for the same rows.
    const rawTable = dataTable.raw();
    const keys = rawTable[0];

    for (let i = 1; i < rawTable.length; i++) {
      const object: Record<string, unknown> = {};
      const rawObject = rawTable[i];

      for (let j = 0; j < keys.length; j++) {
        if (rawObject[j] !== "-") {
          // eslint-disable-next-line no-eval
          object[keys[j]] = eval(`const o = ${rawObject[j]}; o`);
        }
      }

      objectArray.push(object);
    }

    return objectArray;
  }

  /**
   * Intantiate a SDK
   *
   * @param options.port Used to connect the SDK to a specific node of the cluster
   */
  getSDK({ port } = { port: this.port }) {
    let protocol: any;

    switch (this.protocol) {
      case "http":
        protocol = new Http(this.host, { port: Number(port) });
        break;
      case "websocket":
        protocol = new WebSocket(this.host, { port: Number(port) });
        break;
      default:
        throw new Error(`Unknown protocol "${this.protocol}".`);
    }

    return new Kuzzle(protocol, { deprecationWarning: false });
  }

  /**
   * Await the promise provided in the argument, and throw an error depending
   * on whether we expect the action to succeed or not
   *
   * @param  {Promise} promise
   * @param  {boolean} failureExpected
   * @param  {string} [message] optional custom error message
   * @throws If expectations are not met
   */
  async tryAction(
    promise: Promise<unknown>,
    failureExpected: boolean,
    message?: string,
  ): Promise<void> {
    this.props.error = null;

    try {
      this.props.result = await promise;
    } catch (e) {
      this.props.error = e;
    }

    if (failureExpected && !this.props.error) {
      throw new Error(message || "Expected action to fail");
    }

    if (!failureExpected && this.props.error) {
      throw this.props.error;
    }
  }

  /**
   * Re-try to validate the same predicate N times.
   *
   * By default, it will wait for a maximum of 5 seconds.
   *
   * You may want to increase cucumber default step timeout:
   * `Then(..., { timeout: 5000 }, async function (...) {`
   *
   * @param predicate Function throwing an exception when fail to validate
   * @param options.retries Max number of retries (`100`)
   * @param options.interval Interval between retries in ms (`50`)
   */
  async retry(
    predicate: () => unknown,
    { retries = 100, interval = 50 } = {},
  ): Promise<void> {
    let count = 0;
    let failure = true;

    while (failure) {
      try {
        await predicate();
        failure = false;
      } catch (error) {
        if (count >= retries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, interval));

        count++;
      }
    }
  }
}

setWorldConstructor(KuzzleWorld);
setDefaultTimeout(30000);
