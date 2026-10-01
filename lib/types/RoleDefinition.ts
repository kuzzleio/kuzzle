import type { RoleRightsDefinition } from "kuzzle-types";

/**
 * A role definition: its rights, under `controllers`, in the shape of the API
 * contract's `RoleRightsDefinition`
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
  controllers: RoleRightsDefinition;
};
