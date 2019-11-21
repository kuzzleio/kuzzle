const
  {
    Given
  } = require('cucumber');


Given('I {string} the pipe on {string} with the following changes:', async function (state, event, dataTable) {
  const
    payload = this.parseObject(dataTable),
    request = {
      controller: 'functional-test-plugin/pipes',
      action: 'manage',
      state,
      event,
      body: payload
    };

  await this.sdk.query(request);
});
