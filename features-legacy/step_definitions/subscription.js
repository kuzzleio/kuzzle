'use strict';

const
  {
    Given,
    Then
  } = require('cucumber');

Given(/^A room subscription listening to "([^"]*)" having value "([^"]*)"(?: with socket "([^"]*)")?$/, function (key, value, socketName) {
  const filter = {
    equals: {
      [key]: value
    }
  };

  return this.api.subscribe(filter, socketName)
    .then(body => {
      if (body.error) {
        throw body.error;
      }
    });
});

Given(/^A room subscription listening to the whole collection$/, function (callback) {
  this.api.subscribe({})
    .then(body => {
      if (body.error !== null) {
        callback(new Error(body.error.message));
        return false;
      }

      callback();
    })
    .catch(function (error) {
      callback(new Error(error));
    });
});

Given(/^A room subscription listening field "([^"]*)" doesn't exists$/, function (key, callback) {
  var filter = { not: { exists: { field : key } } };

  this.api.subscribe(filter)
    .then(body => {
      if (body.error !== null) {
        callback(new Error(body.error.message));
        return false;
      }

      callback();
    })
    .catch(function (error) {
      callback(new Error(error));
    });
});

Then(/^I unsubscribe(?: socket "([^"]*)")?/, function (socketName, callback) {
  var rooms;

  if (socketName) {
    rooms = Object.keys(this.api.subscribedRooms[socketName]);
  }
  else {
    socketName = Object.keys(this.api.subscribedRooms)[0];
    rooms = Object.keys(this.api.subscribedRooms[socketName]);
  }

  if (rooms.length === 0) {
    callback(new Error('Cannot unsubscribe: no subscribed rooms'));
    return false;
  }

  this.api.unsubscribe(rooms[rooms.length - 1], socketName)
    .then(function () {
      callback();
    })
    .catch(function (error) {
      callback(new Error(error));
    });
});

Then(/^I can count "([^"]*)" subscription/, function (number, callback) {
  this.api.countSubscription()
    .then(function (response) {
      if (response.error) {
        return callback(new Error(response.error.message));
      }

      if (!response.result.count) {
        return callback(new Error('Expected a "count" value in response'));
      }

      if (response.result.count !== parseInt(number)) {
        return callback(new Error('No correct value for count. Expected ' + number + ', got ' + JSON.stringify(response.result.count)));
      }

      callback();
    })
    .catch(function (error) {
      callback(new Error(error));
    });
});

Then(/^I get the list subscriptions$/, function (callback) {
  this.api.listSubscriptions()
    .then(response => {
      if (response.error) {
        return callback(new Error(response.error.message));
      }

      if (!response.result) {
        return callback(new Error('No result provided'));
      }

      this.result = response.result;
      callback();
    })
    .catch(error => {
      callback(error);
    });
});

Then(/^In my list there is a collection "([^"]*)" with ([\d]*) room and ([\d]*) subscriber$/, function(collection, countRooms, countSubscribers, callback) {
  var
    rooms = Object.keys(this.result[this.fakeIndex][collection]),
    count = 0;

  if (!this.result[this.fakeIndex]) {
    return callback(new Error('No entry for index ' + this.fakeIndex));
  }

  if (!this.result[this.fakeIndex][collection]) {
    return callback(new Error('No entry for collection ' + collection));
  }

  if (rooms.length !== parseInt(countRooms)) {
    return callback(new Error('Wrong number rooms for collection ' + collection + '. Expected ' + countRooms + ' get ' + rooms.length));
  }

  rooms.forEach(roomId => {
    count += this.result[this.fakeIndex][collection][roomId];
  });

  if (count !== parseInt(countSubscribers)) {
    return callback(new Error('Wrong number subscribers for collection ' + collection + '. Expected ' + countSubscribers + ' get ' + count));
  }

  callback();
});

Then(/^I use my JWT to subscribe to field "([^"]*)" having value "([^"]*)"(?: with socket "([^"]*)")?$/, function (key, value, socketName) {
  const filter = {
    equals: {
      [key]: value
    }
  };

  return this.api.subscribe(filter, socketName, true)
    .then(body => {
      if (body.error) {
        throw body.error;
      }
    });
});
