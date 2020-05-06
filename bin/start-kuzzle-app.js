const mappings = require('./mappings.json');
const { Application, errors } = require('../index');

const app = new Application('omniscient');

app.mappings = mappings;
app.securities = './securities.json';

app.pipes = {
  'server:afterNow': () => {
    app.context.log.info(`Server INFO: ${app.config.name}`);

    return (new Date()).toUTCString();
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

app.context // null until app has started

app.start()
  .then(() => console.log('Application started'))