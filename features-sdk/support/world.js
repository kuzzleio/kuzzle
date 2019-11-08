const
  config = require('../../lib/config'),
  _ = require('lodash'),
  { setWorldConstructor } = require('cucumber');

class KuzzleWorld {
  constructor (attach, parameters) {
    this.attach = attach.attach;
    this.parameters = parameters;

    this.host = process.env.KUZZLE_HOST || 'localhost';
    this.port = process.env.KUZZLE_PORT || '7512';
    this.protocol = process.env.KUZZLE_PROTOCOL || 'websocket';

    this.kuzzleConfig = config;

    // Intermediate steps should store values inside this object
    this.props = {};

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

  matchObject (object, expected) {
    for (const [keyPath, expectedValue] of Object.entries(expected)) {
      const objectValue = _.get(object, keyPath);

      if (expectedValue === '_any_') {
        should(objectValue).not.be.undefined();
      }
      else {
        should(objectValue).match(expectedValue, `${keyPath} does not match. Expected ${expectedValue} have ${objectValue}`);
      }
    }
  }

}

setWorldConstructor(KuzzleWorld);

module.exports = KuzzleWorld;
