const { Backend } = require('../../../index');

const app = new Backend('functional-tests-app');

// pipe registration
app.pipe.register('server:afterNow', request => {
  request.result = 'Today is today';

  return request;
});

// hook registration and embedded SDK realtime publish
app.hook.register('custom:event', async () => {
  await this.context.accessors.sdk.realtime.publish(
    'functionnal-test',
    'hooks',
    { event: 'custom:event' });
});

app.controller.register('tests', {
  actions: {
    // controller registration and http route generation
    sayHello: {
      handler: async request => `Hello, ${request.input.args.name}`
    },

    // trigger custom events
    triggerEvent: {
      handler: request => app.trigger('custom:event', request.input.args.name)
    },

    // vault
    vault: {
      handler: () => app.vault.secrets
    }
  }
});


const run = async () => {
  try {
    await app.start();
  }
  catch (error) {
    console.log(error);
    process.exit(1);
  }
};

run();