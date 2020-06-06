'use strict';

const should = require('should');
const { Then } = require('cucumber');

Then('I subscribe to {string}:{string} notifications', async function (index, collection) {
  const roomId = await this.sdk.realtime.subscribe(index, collection, {}, notification => {
    this.props.subscriptions[`${index}:${collection}`].notifications.push(notification);
  });

  if (! this.props.subscriptions) {
    this.props.subscriptions = {};
  }

  this.props.subscriptions[`${index}:${collection}`] = {
    unsubscribe: () => this.sdk.realtime.unsubscribe(roomId),
    notifications: []
  };
});

Then('I should receive realtime notifications for {string}:{string} matching:', function (index, collection, datatable, done) {
  setTimeout(() => {
    const expectedNotifications = this.parseObjectArray(datatable);

    should(this.props.subscriptions[`${index}:${collection}`]).not.be.undefined();

    const subscription = this.props.subscriptions[`${index}:${collection}`];

    should(subscription.notifications).be.length(expectedNotifications.length);

    for (let i = 0; i < expectedNotifications.length; i++) {
      should(subscription.notifications[i]).matchObject(expectedNotifications[i]);
    }

    done();
  }, 100);
});