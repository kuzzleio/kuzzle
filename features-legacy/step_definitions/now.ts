import { When, Then } from "@cucumber/cucumber";
import type KWorld from "../support/world";

When(/^I get the server timestamp$/, function (this: KWorld, callback) {
  this.api
    .now()
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
    .catch((error) => callback(error));
});

Then(/^I can read the timestamp$/, function (this: KWorld, callback) {
  if (!this.result.now || !Number.isInteger(this.result.now)) {
    return callback("Expected a timestamp result, got: " + this.result);
  }

  callback();
});
