'use strict';

const should = require('should');
const { Given, Then, When } = require('cucumber');
const ws = require('ws');

Given('I open a new local websocket connection', async function () {
  this.props.client = new ws('ws://localhost:7512');
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  await delay(1000);
  this.props.client.on('message', data => {
    this.props.result = JSON.parse(data);
  });
});

When('I send the message {string} to Kuzzle through websocket', function (message) {
  this.props.client.send(message);
});

Then('I should receive a response message from Kuzzle through websocket matching:', function (dataTable) {
  const message = this.parseObject(dataTable);
  should(this.props.result).be.eql(message);
});

Then('I terminate the websocket connection', function () {
  this.props.client.terminate();
  this.props.client = undefined;
});
