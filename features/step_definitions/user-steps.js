'use strict';

const _ = require('lodash');
const should = require('should');
const { Then } = require('cucumber');

Then('I delete the user {string}', async function (userId) {
  this.props.result = await this.sdk.user.delete(userId, { refresh: 'wait_for' });
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

  this.props.result = await this.sdk.user.create(
    userId,
    body,
    { refresh: 'wait_for' });
});

Then('The user {string} should have the following profiles:', async function (userId, dataTable) {
  const expectedProfiles = _.flatten(dataTable.rawTable);

  const user = await this.sdk.user.get(userId);

  should(user.profileIds).be.eql(expectedProfiles);
});

Then(/The user "(.*?)"( should not)? exists/, async function (userId, shouldNot) {
  try {
    await this.sdk.user.get(userId);

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
