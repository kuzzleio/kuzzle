'use strict';

const should = require('should');
const { Then } = require('cucumber');

Then('I am listening to notifications on {string}:{string}', async function (index, collection) {
  this.props.subscription = {
    notifications: [],
    unsubscribe: null
  };

  const roomId = await this.sdk.realtime.subscribe(
    index,
    collection,
    {},
    notification => {
      this.props.subscription.notifications.push(notification);
    });

  this.props.subscription.unsubscribe = () => this.sdk.realtime.unsubscribe(roomId);
});

Then('I should have receive {string} notifications', function (rawNumber) {
  const expectedCount = parseInt(rawNumber, 10);

  should(this.props.subscription.notifications).have.length(expectedCount);
});