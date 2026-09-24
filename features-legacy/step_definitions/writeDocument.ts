import { Then, When } from "@cucumber/cucumber";
import Bluebird from "bluebird";
import type KWorld from "../support/world";

When(
  /^I ?(can't)* write the document ?(?:"([^"]*)")?(?: in index "([^"]*)")?( with id "[^"]+")?$/,
  function (this: KWorld, cant, documentName, index, id) {
    const document = this.document(documentName);

    if (id) {
      id = id.replace(/^ with id "([^"]+)"$/, "$1");
    }

    return this.api
      .create(document, index, undefined, undefined, id)
      .then((body) => {
        if (body.error) {
          if (cant) {
            return Bluebird.resolve();
          }
          throw body.error;
        }

        if (!body.result) {
          throw new Error(`No result: ${JSON.stringify(body)}`);
        }

        this.result = body.result;
      })
      .catch((err) => {
        if (cant) {
          return;
        }
        throw err;
      });
  },
);

When(/^I createOrReplace it$/, function (this: KWorld, callback) {
  const document = JSON.parse(JSON.stringify(this.documentGrace));

  document._id = this.result._id;

  this.api
    .createOrReplace(document)
    .then((body) => {
      if (body.error) {
        callback(new Error(body.error.message));
        return false;
      }

      if (!body.result) {
        callback(new Error("No result provided"));
        return false;
      }

      this.updatedResult = body.result;
      callback();
    })
    .catch(function (error) {
      callback(error);
    });
});

Then(/^I should have updated the document$/, function (this: KWorld, callback) {
  if (
    this.updatedResult._id === this.result._id &&
    this.updatedResult._version === this.result._version + 1
  ) {
    this.result = this.updatedResult;
    callback();
    return false;
  }

  callback(
    new Error(
      "The received document is not an updated version of the previous one. \n" +
        "Previous document: " +
        JSON.stringify(this.result) +
        "\n" +
        "Received document: " +
        JSON.stringify(this.updatedResult),
    ),
  );
});

Then(
  /^I update the document with value "([^"]*)" in field "([^"]*)"(?: in index "([^"]*)")?$/,
  function (this: KWorld, value, field, index) {
    const body = {
      [field]: value,
    };

    return this.api.update(this.result._id, body, index).then((aBody) => {
      if (aBody.error) {
        return Bluebird.reject(aBody.error);
      }
      if (!aBody.result) {
        return Bluebird.reject(new Error("No result provided"));
      }
    });
  },
);

Then(
  /^I replace the document with "([^"]*)" document$/,
  function (this: KWorld, documentName, callback) {
    const document = JSON.parse(JSON.stringify(this.document(documentName)));

    document._id = this.result._id;
    this.api
      .replace(document)
      .then((body) => {
        if (body.error) {
          callback(new Error(body.error.message));
          return false;
        }

        if (!body.result) {
          callback(new Error("No result provided"));
          return false;
        }

        this.updatedResult = body.result;
        callback();
      })
      .catch(function (error) {
        callback(error);
      });
  },
);
