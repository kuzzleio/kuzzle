/**
 * Represents a password policy of the local auth strategy plugin.
 *
 * @see https://docs.kuzzle.io/core/2/guides/main-concepts/authentication#password-policies
 *
 * @example
 *
 * {
 *   "appliesTo": {
 *     "profiles": ["editor"],
 *     "roles": ["admin"]
 *   },
 *   "expiresAfter": "30d",
 *   "mustChangePasswordIfSetByAdmin": true,
 *   "passwordRegex": "^(?=.*[a-zA-Z])(?=.*[0-9])(?=.{8,})"
 * }
 */
export type PasswordPolicy = {
  /**
   * Applies the policy to matching users.
   *
   * Can be either set to a wildcar (`"*""`) to match all users or to an
   * object containing at least of the following property.
   */
  appliesTo: '*' | {
    /**
     * Array of user kuids the policy applies to.
     */
    users?: string[];

    /**
     * Array of profile ids the policy applies to.
     */
    profiles?: string[];

    /**
     * Array of role ids the policy applies to.
     */
    roles?: string[];
  };

  /**
   * The delay after which a password expires.
   *
   * @see https://www.npmjs.com/package/ms
   *
   * Users with expired passwords are given a resetPasswordToken when logging in
   * and must change their password to be allowed to log in again.
   */
  expiresAfter: string;

  /**
   * If set to true, prevents users to use their username in part of the password.
   *
   * The check is case-insensitive.
   */
  forbidLoginInPassword: boolean;

  /**
   * The number of passwords to store in history and checked against
   * when a new password is set to prevent passwords reuse.
   */
  forbidReusedPasswordCount: number;

  /**
   * If set to true, whenever a password is set for a user by someone else,
   * that user will receive a resetPasswordToken upon their next login and
   * they will have to change their password before being allowed to log in again.
   */
  mustChangePasswordIfSetByAdmin: boolean;

  /**
   * A string representation of a regular expression to test on new passwords.
   *
   * @example
   *
   * // must be at least 6 chars long
   * ".{6,}"
   *
   * // must be at least 8 chars long and include at least one letter and one digit
   * "^(?=.*[a-zA-Z])(?=.*[0-9])(?=.{8,})"
   */
  passwordRegex: string;
};

