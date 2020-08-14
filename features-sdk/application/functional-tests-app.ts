'use strict';

import { Backend } from '../../index';
import * as FunctionalTestPlugin from '../../plugins/available/functional-test-plugin';

const app = new Backend('functional-tests-app');

// Easier debug
app.hook.register('request:onError', request => {
  console.log(request.error);
});

app.config.set('plugins.cluster.privileged', true);

// Pipe management
const activatedPipes: any = {};

app.controller.register('pipes', {
  actions: {
    deactivateAll: {
      handler: async () => {
        const values: any = Object.values(activatedPipes);

        for (const pipe of values) {
          pipe.state = 'off';
        }

        return null;
      }
    },
    manage: {
      handler: async request => {
        const payload = request.input.body;
        const state = request.input.args.state;
        const event = request.input.args.event;

        activatedPipes[event] = {
          payload,
          state,
        };

        return null;
      }
    }
  }
});

/* Actual code for tests start here */

// Pipe registration
app.pipe.register('server:afterNow', async request => {
  const pipe = activatedPipes['server:afterNow'];

  if (pipe && pipe.state !== 'off') {
    request.response.result = { coworking: 'Spiced' };
  }

  return request;
});

// Hook registration and embedded SDK realtime publish
app.hook.register('custom:event', async name => {
  await app.sdk.realtime.publish(
    'app-functional-test',
    'hooks',
    { event: 'custom:event', name });
});

app.controller.register('tests', {
  actions: {
    // Controller registration and http route definition
    sayHello: {
      handler: async request => {
        return { greeting: `Hello, ${request.input.args.name}` };
      },
      http: [{ verb: 'POST', url: '/hello/:name' }]
    },

    // Trigger custom event
    triggerEvent: {
      handler: async request => {
        await app.trigger('custom:event', request.input.args.name);

        return { trigger: 'custom:event', payload: request.input.args.name }
      }
    },

    // Access Vault secrets
    vault: {
      handler: async () => app.vault.secrets
    },

    // ESClient constructor
    esClient: {
      handler: async request => {
        const client = new app.ESClient();
        const esRequest = {
          body: request.input.body,
          id: request.input.resource._id,
          index: request.input.resource.index,
        };

        const { body } = await client.index(esRequest);

        return body;
      },
      http: [{ verb: 'POST', url: '/es-client/:index/:_id' }],
    }
  }
});

app.plugin.use(new FunctionalTestPlugin());

let vaultfile = 'features-sdk/fixtures/secrets.enc.json';
if (process.env.SECRETS_FILE_PREFIX) {
  vaultfile = process.env.SECRETS_FILE_PREFIX + vaultfile;
}
app.vault.file = vaultfile;
app.vault.key = 'secret-password';

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
