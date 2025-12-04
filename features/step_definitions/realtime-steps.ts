import { Then } from "@cucumber/cucumber";

// TODO should is deprecated it needs to be removed
// eslint-disable-next-line @typescript-eslint/no-var-requires
const should = require("should");

Then(
  "I subscribe to {string}:{string} notifications",
  async function (index, collection) {
    if (!this.props.subscriptions) {
      this.props.subscriptions = {};
    }

    const roomId = await this.sdk.realtime.subscribe(
      index,
      collection,
      {},
      (notification: any) => {
        this.props.subscriptions[`${index}:${collection}`].notifications.push(
          notification,
        );
      },
    );

    this.props.subscriptions[`${index}:${collection}`] = {
      notifications: [],
      unsubscribe: () => this.sdk.realtime.unsubscribe(roomId),
    };
  },
);

Then("I unsubscribe from the current room via the plugin", async function () {
  const roomId = this.props.result.roomId;
  const connectionId = this.props.result.connectionId;

  const response = await this.sdk.query({
    action: "unregisterSubscription",
    body: {
      connectionId,
      roomId,
    },
    controller: "functional-test-plugin/accessors",
  });

  this.props.result = response.result;
});

Then(
  "I should have receive {string} notifications for {string}:{string}",
  function (rawNumber, index, collection) {
    return this.retry(() => {
      const expectedCount = parseInt(rawNumber, 10);

      should(
        this.props.subscriptions[`${index}:${collection}`].notifications,
      ).have.length(expectedCount);
    });
  },
);

Then(
  "I should receive realtime notifications for {string}:{string} matching:",
  function (index, collection, datatable, done) {
    const tryAssert = () => {
      const expectedNotifications = this.parseObjectArray(datatable);

      should(
        this.props.subscriptions[`${index}:${collection}`],
      ).not.be.undefined();

      const subscription = this.props.subscriptions[`${index}:${collection}`];

      should(subscription.notifications).be.length(
        expectedNotifications.length,
      );

      for (let i = 0; i < expectedNotifications.length; i++) {
        should(subscription.notifications[i]).matchObject(
          expectedNotifications[i],
        );
      }
    };

    setTimeout(() => {
      try {
        tryAssert();

        done();
      } catch (error) {
        // retry later
        setTimeout(() => {
          tryAssert();

          done();
        }, 500);
      }
    }, 100);
  },
);
