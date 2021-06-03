'use strict';

const _ = require('lodash');
const should = require('should');
const { Then } = require('cucumber');

Then('I delete the user {string}', async function (userId) {
  this.props.result = await this.sdk.query({
    action: 'delete',
    controller: 'user',
    _id: userId,
    refresh: 'wait_for',
  });
});

Then('I create a user {string} with content:', async function (userId, dataTable) {
  const content = this.parseObject(dataTable);

  const body = {
    content,
    credentials: {
      local: {
        username: userId,
        password: 'password'
      }
    }
  };

  this.props.result = await this.sdk.query({
    action: 'create',
    controller: 'user',
    _id: userId,
    refresh: 'wait_for',
    body
  });
});

Then('The user {string} should have the following profiles:', async function (userId, dataTable) {
  const expectedProfiles = _.flatten(dataTable.rawTable);

  const { result: user } = await this.sdk.query({
    action: 'get',
    controller: 'user',
    _id: userId
  });

  should(_.get(user._source, 'profileIds')).be.eql(expectedProfiles);
});

Then(/The user "(.*?)"( should not)? exists/, async function (userId, shouldNot) {
  try {
    await this.sdk.query({
      action: 'get',
      controller: 'user',
      _id: userId
    });

    if (shouldNot) {
      throw new Error(`User "${userId}" should not exists.`);
    }
  }
  catch (error) {
    if (error.status === 404) {
      if (! shouldNot) {
        throw new Error(`User "${userId}" should exists.`);
      }
    }
    else {
      throw error;
    }
  }
});

Then(/The content of user "(.+)" should( not)? match:/, async function (userId, shouldNot, dataTable) {
  const expectedContent = this.parseObject(dataTable);

  const user = await this.sdk.query({
    action: 'get',
    controller: 'user',
    _id: userId
  });

  for (const [key, value] of Object.entries(expectedContent)) {
    if (shouldNot) {
      should(_.get(user._source, key)).not.be.eql(value);
    }
    else {
      should(_.get(user._source, key)).be.eql(value);
    }
  }
});
