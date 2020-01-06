'use strict';

const
  config = require('../../lib/config'),
  { Kuzzle, WebSocket, Http } = require('kuzzle-sdk'),
  { setWorldConstructor } = require('cucumber');

require('./assertions');

class KuzzleWorld {
  constructor (attach, parameters) {
    this.attach = attach.attach;
    this.parameters = parameters;

    this._host = process.env.KUZZLE_HOST || 'localhost';
    this._port = process.env.KUZZLE_PORT || '7512';
    this._protocol = process.env.KUZZLE_PROTOCOL || 'websocket';

    this.kuzzleConfig = config;

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
    const content = dataTable.rowsHash();

    for (const key of Object.keys(content)) {
      content[key] = JSON.parse(content[key]);
    }

    return content;
  }

  parseObjectArray (dataTable) {
    const
      objectArray = [],
      keys = dataTable.rawTable[0];

    for (let i = 1; i < dataTable.rawTable.length; i++) {
      const
        object = {},
        rawObject = dataTable.rawTable[i];

      for (let j = 0; j < keys.length; j++) {
        if (rawObject[j] !== '-') {
          object[keys[j]] = JSON.parse(rawObject[j]);
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

    return new Kuzzle(protocol);
  }
}

setWorldConstructor(KuzzleWorld);

module.exports = KuzzleWorld;
