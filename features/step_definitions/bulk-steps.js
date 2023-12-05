"use strict";

const { When, Then } = require("cucumber"),
  should = require("should");

const actionName = (action) => Object.keys(action)[0];
const actionBody = (action) => action[actionName(action)];

When("I perform a bulk import with the following:", async function (dataTable) {
  const bulkData = dataTable.rawTable.map(JSON.parse);

  this.props.result = await this.sdk.bulk.import(
    this.props.index,
    this.props.collection,
    bulkData,
  );
});

Then("I should receive a bulk result matching:", function (dataTable) {
  const expectedResult = dataTable.rawTable.map(JSON.parse);

  for (let i = 0; i < this.props.result.successes.length; i++) {
    const successAction = this.props.result.successes[i];

    should(actionName(successAction)).match(actionName(expectedResult[i]));
    should(actionBody(successAction)).match(actionBody(expectedResult[i]));
  }
});

Then("I should receive a bulk error matching:", function (dataTable) {
  const expectedError = dataTable.rawTable.map(JSON.parse);

  for (let i = 0; i < this.props.result.errors.length; i++) {
    const errorAction = this.props.result.errors[i];

    should(actionName(errorAction)).match(actionName(expectedError[i]));
    should(actionBody(errorAction)).match(actionBody(expectedError[i]));
  }
});

Then(
  "I perform a bulk deleteByQuery with the query:",
  async function (rawQuery) {
    const query = JSON.parse(rawQuery);

    const request = {
      controller: "bulk",
      action: "deleteByQuery",
      index: this.props.index,
      collection: this.props.collection,
      refresh: "wait_for",
      body: { query },
    };

    const { result } = await this.sdk.query(request);

    this.props.result = result;
  },
);
