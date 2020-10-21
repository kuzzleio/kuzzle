'use strict';

const net = require('net');
const fs = require('fs');
const { Then } = require('cucumber');


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
