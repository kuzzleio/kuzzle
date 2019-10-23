class FunctionalTestPlugin {
  constructor () {
    this.controllers = {
      constructors: {
        ESClient: 'testConstructorsESClient'
      }
    };

    this.routes = [
      { verb: 'post', url: '/constructors/esclient', controller: 'constructors', action: 'ESClient' }
    ];
  }

  init (config, context) {
    this.config = config;
    this.context = context;
  }

  async testConstructorsESClient (request) {
    const
      client = new this.context.constructors.ESClient(),
      esRequest = {
        id: request.input.resource._id,
        index: request.input.resource.index,
        body: request.input.body
      };

    const { body } = await client.index(esRequest);

    return body;
  }
}

module.exports = FunctionalTestPlugin;
