import { When, Then } from "@cucumber/cucumber";
import type KWorld from "../support/world";

When(/^I publish a message$/, function (this: KWorld, callback) {
  this.api
    .publish(this.documentGrace)
    .then((body) => {
      if (body.error) {
        callback(new Error(body.error.message));
        return false;
      }

      if (!body.result) {
        callback(new Error("No result provided"));
        return false;
      }

      this.result = body;
      callback();
    })
    .catch(function (error) {
      callback(error);
    });
});

Then(/^I should receive a request id$/, function (this: KWorld, callback) {
  if (this.result && this.result.requestId) {
    callback();
    return false;
  }

  callback(new Error("No request id returned"));
});
