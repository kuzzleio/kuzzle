// See https://docs.kuzzle.io/api/1/controller-admin/load-securities/

module.exports = {
  users: {
    'test-admin': {
      content: {
        profileIds: ['admin']
      },
      credentials: {
        local: {
          username: 'test-admin',
          password: 'password'
        }
      }
    }
  }
};