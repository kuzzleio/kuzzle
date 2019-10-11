const
  _ = require('lodash'),
  should = require('should'),
  {
    When,
    Then
  } = require('cucumber');

When(/I (successfully )?call the route "(.*?)":"(.*?)" with args:/, async function (expectSuccess, controller, action, dataTable) {
  const args = this.parseObject(dataTable);

  try {
    const response = await this.sdk.query({ controller, action, ...args });

    this.props.result = response.result;
  }
  catch (error) {
    if (expectSuccess) {
      throw error;
    }

    this.props.error = error;
  }
});

When(/I (successfully )?call the route "(.*?)":"(.*?)"$/, async function (expectSuccess, controller, action) {
  try {
    const response = await this.sdk.query({ controller, action });

    this.props.result = response.result;
  }
  catch (error) {
    if (expectSuccess) {
      throw error;
    }

    this.props.error = error;
  }
});

Then('I should receive a result matching:', function (dataTable) {
  const expectedResult = this.parseObject(dataTable);

  should(this.props.result).not.be.undefined();

  should(this.props.result).match(expectedResult);
});

Then('I should receive an empty result', function () {
  should(this.props.result).be.undefined();
});

Then('I should receive an error matching:', function (dataTable) {
  const expectedError = this.parseObject(dataTable);

  should(this.props.error).not.be.undefined();

  should(this.props.error).match(expectedError);
});

Then('I debug {string}', function (path) {
  console.log(JSON.stringify(_.get(this.props, path), null, 2));
});