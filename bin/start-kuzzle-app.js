// const mappings = require('./mappings.json');
const { Application, errors } = require('../index');

const app = new Application('omniscient');

// app.mappings = mappings;
// app.securities = './securities.json';

app.pipes = {
  'server:afterNow': async request => {
    app.context.log.info(`Server INFO: ${app.name}`);

    request.result.now = (new Date()).toUTCString()
    return request;
  },
  'auth:beforeLogin': () => {
    throw errors.BadRequestError('Invalid');
  }
};

app.hooks = {
  'server:beforeNow': () => {
    console.log('server before now');
  }
};

app.controllers = {
  'customer': {
    'create': async request => {
      console.log(`Create customer ${request.input.args.name}`);
    }
  }
};

app.start()
  .then(() => {
    console.log('Application started')
  })