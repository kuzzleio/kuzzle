/**
 * A role definition
 *
 * @see https://docs.kuzzle.io/core/2/guides/main-concepts/permissions/#roles
 *
 * @example
 *
 * {
 *    controllers: {
 *      auth: {
 *        actions: {
 *          getCurrentUser: true,
 *          logout: true
 *        }
 *      }
 *    }
 * }
 */
export type RoleDefinition = {
  controllers: {
    [controllerName: string]: {
      actions: {
        [actionName: string]: boolean;
      };
    };
  };
};
