import { Given, Then } from "@cucumber/cucumber";
import { asError, realtimeApi } from "../support/stepUtils";
import type KWorld from "../support/world";

Given(
  /^A room subscription listening to "([^"]*)" having value "([^"]*)"(?: with socket "([^"]*)")?$/,
  function (this: KWorld, key, value, socketName) {
    const filter = {
      equals: {
        [key]: value,
      },
    };

    return realtimeApi(this)
      .subscribe(filter, socketName)
      .then((body) => {
        if (body.error) {
          throw body.error;
        }
      });
  },
);

Given(
  /^A room subscription listening to the whole collection$/,
  function (this: KWorld, callback) {
    realtimeApi(this)
      .subscribe({})
      .then((body) => {
        if (body.error !== null) {
          callback(new Error(body.error.message));
          return false;
        }

        callback();
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  },
);

Given(
  /^A room subscription listening field "([^"]*)" doesn't exists$/,
  function (this: KWorld, key, callback) {
    const filter = { not: { exists: { field: key } } };

    realtimeApi(this)
      .subscribe(filter)
      .then((body) => {
        if (body.error !== null) {
          callback(new Error(body.error.message));
          return false;
        }

        callback();
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  },
);

Then(
  /^I unsubscribe(?: socket "([^"]*)")?/,
  function (this: KWorld, socketName, callback) {
    let rooms;

    if (socketName) {
      rooms = Object.keys(realtimeApi(this).subscribedRooms[socketName]);
    } else {
      socketName = Object.keys(realtimeApi(this).subscribedRooms)[0];
      rooms = Object.keys(realtimeApi(this).subscribedRooms[socketName]);
    }

    if (rooms.length === 0) {
      callback(new Error("Cannot unsubscribe: no subscribed rooms"));
      return false;
    }

    const room = rooms[rooms.length - 1];
    // `unsubscribe` answers nothing when the socket or the room has already
    // gone, and the step used to call `.then` on that nothing.
    const unsubscribed = realtimeApi(this).unsubscribe(room, socketName);

    if (!unsubscribed) {
      callback(
        new Error(
          `Cannot unsubscribe: room "${room}" is not open on "${socketName}"`,
        ),
      );
      return;
    }

    unsubscribed
      .then(function () {
        callback();
      })
      .catch(function (error) {
        callback(asError(error));
      });
  },
);

Then(
  /^I can count "([^"]*)" subscription/,
  function (this: KWorld, number, callback) {
    realtimeApi(this)
      .countSubscription()
      .then(function (response) {
        if (response.error) {
          return callback(new Error(response.error.message));
        }

        if (!response.result.count) {
          return callback(new Error('Expected a "count" value in response'));
        }

        if (response.result.count !== parseInt(number)) {
          return callback(
            new Error(
              "No correct value for count. Expected " +
                number +
                ", got " +
                JSON.stringify(response.result.count),
            ),
          );
        }

        callback();
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  },
);

Then(/^I get the list subscriptions$/, function (this: KWorld, callback) {
  realtimeApi(this)
    .listSubscriptions()
    .then((response) => {
      if (response.error) {
        return callback(new Error(response.error.message));
      }

      if (!response.result) {
        return callback(new Error("No result provided"));
      }

      this.result = response.result;
      callback();
    })
    .catch((error) => {
      callback(error);
    });
});

Then(
  /^In my list there is a collection "([^"]*)" with ([\d]*) room and ([\d]*) subscriber$/,
  function (this: KWorld, collection, countRooms, countSubscribers, callback) {
    const rooms = Object.keys(this.result[this.fakeIndex][collection]);
    let count = 0;

    if (!this.result[this.fakeIndex]) {
      return callback(new Error("No entry for index " + this.fakeIndex));
    }

    if (!this.result[this.fakeIndex][collection]) {
      return callback(new Error("No entry for collection " + collection));
    }

    if (rooms.length !== parseInt(countRooms)) {
      return callback(
        new Error(
          "Wrong number rooms for collection " +
            collection +
            ". Expected " +
            countRooms +
            " get " +
            rooms.length,
        ),
      );
    }

    for (const roomId of rooms) {
      count += this.result[this.fakeIndex][collection][roomId];
    }

    if (count !== parseInt(countSubscribers)) {
      return callback(
        new Error(
          "Wrong number subscribers for collection " +
            collection +
            ". Expected " +
            countSubscribers +
            " get " +
            count,
        ),
      );
    }

    callback();
  },
);

Then(
  /^I use my JWT to subscribe to field "([^"]*)" having value "([^"]*)"(?: with socket "([^"]*)")?$/,
  function (this: KWorld, key, value, socketName) {
    const filter = {
      equals: {
        [key]: value,
      },
    };

    return realtimeApi(this)
      .subscribe(filter, socketName, true)
      .then((body) => {
        if (body.error) {
          throw body.error;
        }
      });
  },
);
