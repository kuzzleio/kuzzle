const { setWorldConstructor } = require('cucumber');

class KuzzleWorld {
  constructor (attach, parameters) {
    this.attach = attach.attach;
    this.parameters = parameters;

    this.host = process.env.KUZZLE_HOST || 'localhost';
    this.port = process.env.KUZZLE_PORT || '7512';
    this.protocol = process.env.KUZZLE_PROTOCOL || 'websocket';

    // Intermediate steps should store values inside this object
    this.props = {};
  }

  parseDataTable (dataTable) {
    const content = dataTable.rowsHash();

    for (const key of Object.keys(content)) {
      content[key] = JSON.parse(content[key]);
    }

    return content;
  }
}

setWorldConstructor(KuzzleWorld);

module.exports = KuzzleWorld;
