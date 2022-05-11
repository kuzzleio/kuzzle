'use strict';

const { setDefaultTimeout, setWorldConstructor } = require('cucumber');
const { Kuzzle, WebSocket, Http } = require('kuzzle-sdk');

const config = require('../../lib/config');

require('./assertions');

class KuzzleWorld {
  constructor (attach, parameters) {
    this.attach = attach.attach;
    this.parameters = parameters;

    this._host = process.env.KUZZLE_HOST || 'localhost';
    this._port = process.env.KUZZLE_PORT || '7512';
    this._protocol = process.env.KUZZLE_PROTOCOL || 'websocket';

    this.kuzzleConfig = config.loadConfig();

    // Intermediate steps should store values inside this object
    this.props = {};

    this._sdk = this.getSDK();
  }

  get sdk () {
    return this._sdk;
  }

  get host () {
    return this._host;
  }

  get port () {
    return this._port;
  }

  get protocol () {
    return this._protocol;
  }

  parseObject (dataTable) {
    if (typeof dataTable.rowsHash !== 'function') {
      throw new Error('Argument is not a dataTable');
    }

    const content = dataTable.rowsHash();

    for (const key of Object.keys(content)) {
    // eslint-disable-next-line no-eval
      content[key] = eval(`const o = ${content[key]}; o`);
    }

    return content;
  }

  parseObjectArray (dataTable) {
    if (typeof dataTable.rowsHash !== 'function') {
      throw new Error('Argument is not a dataTable');
    }

    const objectArray = [];
    const keys = dataTable.rawTable[0];

    for (let i = 1; i < dataTable.rawTable.length; i++) {
      const object = {};
      const rawObject = dataTable.rawTable[i];

      for (let j = 0; j < keys.length; j++) {
        if (rawObject[j] !== '-') {
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
  getSDK ({ port } = {}) {
    let protocol;

    switch (this.protocol) {
      case 'http':
        protocol = new Http(this.host, { port: port || this.port });
        break;
      case 'websocket':
        protocol = new WebSocket(this.host, { port: port || this.port });
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
  async tryAction (promise, failureExpected, message) {
    this.props.error = null;

    try {
      this.props.result = await promise;
    }
    catch (e) {
      this.props.error = e;
    }

    if (failureExpected && ! this.props.error) {
      throw new Error(message || 'Expected action to fail');
    }

    if (! failureExpected && this.props.error) {
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
  async retry (predicate, { retries = 100, interval = 50 } = {}) {
    let count = 0;

    while (count < retries) {
      try {
        await predicate();
        count = retries;
      }
      catch (error) {
        if (count === retries) {
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, interval));

        count++;
      }
    }
  }
}

setWorldConstructor(KuzzleWorld);
setDefaultTimeout(30000);

module.exports = KuzzleWorld;
