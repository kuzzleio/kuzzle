// See https://docs.kuzzle.io/core/2/api/controllers/admin/load-securities/

export default {
  users: {
    "default-user": {
      content: {
        profileIds: ["default"],
      },
      credentials: {
        local: {
          password: "password",
          username: "default-user",
        },
      },
    },
    "test-admin": {
      content: {
        profileIds: ["admin"],
      },
      credentials: {
        local: {
          password: "password",
          username: "test-admin",
        },
      },
    },
  },
};
