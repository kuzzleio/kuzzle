'use strict';

const { Given } = require('cucumber');

Given('I {string} the {string} pipe on {string} with the following changes:', async function (state, kind, event, dataTable) {
  const controller = kind === 'plugin' ? 'functional-test-plugin/pipes' : 'pipes';
  const payload = this.parseObject(dataTable);
  const request = {
    controller,
    action: 'manage',
    state,
    event,
    body: payload
  };

  await this.sdk.query(request);
});

Given('I {string} the {string} pipe on {string} without changes', async function (state, kind, event) {
  const controller = kind === 'plugin' ? 'functional-test-plugin/pipes' : 'pipes';

  await this.sdk.query({
    controller,
    action: 'manage',
    state,
    event
  });
});

Given('a plugin realtime subscription', async function () {
  await this.sdk.query({
    controller: 'functional-test-plugin/realtime',
    action: 'subscribeOnce',
  });
});
