'use strict';

const net = require('net');
const fs = require('fs');
const { Then, When } = require('cucumber');
const should = require('should');

Then('I send the crafted HTTP multipart request', function (done) {
  const socket = net.createConnection(7512, () => {
    const rq = fs.readFileSync('./features/fixtures/bad-multipart.req');

    socket.write(rq.toString(), error => {
      socket.end();
      done(error);
    });
  });

  socket.on('error', done);
});

Then('Kuzzle is still up', async function () {
  await this.api.serverPublicApi();
});

When('I call a deprecated method I should have good properties', async function() {
  const deprecatedRoutes = this.kuzzleConfig.http.routes.filter(route => route.deprecated);

  for (const route of deprecatedRoutes) {
    const { deprecated } = route;
    should(deprecated).have.property('since');
    should(deprecated).have.property('message');
  }
});
