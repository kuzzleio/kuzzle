/**
 * A profile definition.
 *
 * @see https://docs.kuzzle.io/core/2/guides/main-concepts/permissions/#profiles
 *
 * @example
 *
 * {
 *   rateLimit: 200,
 *   policies: [
 *     {
 *       roleId: 'anonymous',
 *       restrictedTo: [ { index: 'device-manager' } ]
 *     }
 *   ]
 * }
 */
export type ProfileDefinition = {
  /**
   * The rate limit parameter controls how many API requests a user can send,
   * per second and per node.
   */
  rateLimit: number;

  /**
   * Grant a role rights on API actions for this profile.
   *
   * Each role can be restricted to a list of indexes and collections.
   */
  policies: Array<{
    /**
     * Role ID
     */
    roleId: string;

    /**
     * List of indexes and collections to restrict this role on.
     */
    restrictedTo?: Array<{
      /**
       * Index name.
       */
      index: string;

      /**
       * Collection names.
       */
      collections: string[];
    }>;
  }>;
};
