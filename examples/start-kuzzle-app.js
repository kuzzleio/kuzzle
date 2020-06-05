const { Backend } = require('../index');
const FunctionalTestPlugin = require('../plugins/available/functional-test-plugin')

const app = new Backend('omniscient');

app.version = '1.42.21';

app.plugin.use(new FunctionalTestPlugin());

app.controller.register('email', {
  get: {
    handler: async request => console.log(request.input)
  },
  send: {
    handler: async request => console.log(request.input),
    http: [
      { verb: 'post', url: '/email/send' }
    ]
  },
});

app.pipe.register('server:afterNow', async request => {
  app.context.log.info(`Server INFO: ${app.name}`);

  request.result.now = (new Date()).toUTCString();
  return request;
});

app.hook.register('server:beforeNow', () => {
  console.log('server before now');
});

app.config.set('services.foobar.host', 'redisHost');

app.config.merge({
  realtime: {
    pcreSupport: true
  }
});

app.start()
  .then(() => {
    console.log('Application started')
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
