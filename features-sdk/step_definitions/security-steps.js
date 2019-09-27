const
  {
    Given
  } = require('cucumber');

Given('I create a profile {string} with the following policies:', function (profileId, dataTable) {
  let policies = this.parseDataTable(dataTable);

  policies = Array.isArray(policies) ? policies : [policies];

  return this.sdk.security.createProfile(profileId, { policies });
});

Given('I delete the role {string}', function (roleId) {
  return this.sdk.security.deleteRole(roleId);
});

Given('I create a user {string} with content:', function (userId, dataTable) {
  const content = this.parseDataTable(dataTable);

  const user = {
    content,
    credentials: {
      local: {
        username: userId,
        password: 'password'
      }
    }
  };

  return this.sdk.security.createUser(userId, user);
});