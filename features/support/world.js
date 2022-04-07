'use strict';

const { setDefaultTimeout, setWorldConstructor } = require('cucumber');
const { Kuzzle, WebSocket, Http } = require('kuzzle-sdk');
const _ = require('lodash');

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

    this._sdk = this._getSdk();
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

    // Copied from kuzzle iot
    for (const [path, value] of Object.entries(content)) {
      // eslint-disable-next-line no-eval
      content[path] = eval(`const o = ${content[path]}; o`); // Duplicate for legacy test
      // eslint-disable-next-line no-eval
      _.set(content, path.split('.'), eval(`var o = ${value}; o`));
    }

    return content;
  }

  parseObjectArray (dataTable) {
    if (typeof dataTable.rowsHash !== 'function') {
      throw new Error('Argument is not a dataTable');
    }

    const
      objectArray = [],
      keys = dataTable.rawTable[0];

    for (let i = 1; i < dataTable.rawTable.length; i++) {
      const
        object = {},
        rawObject = dataTable.rawTable[i];

      for (let j = 0; j < keys.length; j++) {
        if (rawObject[j] !== '-') {
          // eslint-disable-next-line no-eval
          _.set(object, keys[j], eval(`var o = ${rawObject[j]}; o`));
          // eslint-disable-next-line no-eval
          object[keys[j]] = eval(`const o = ${rawObject[j]}; o`); // Duplicate for legacy test
        }
      }

      objectArray.push(object);
    }

    return objectArray;
  }

  _getSdk () {
    let protocol;

    switch (this.protocol) {
      case 'http':
        protocol = new Http(this.host, { port: this.port });
        break;
      case 'websocket':
        protocol = new WebSocket(this.host, { port: this.port });
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
}

setWorldConstructor(KuzzleWorld);
setDefaultTimeout(30000);

module.exports = KuzzleWorld;
