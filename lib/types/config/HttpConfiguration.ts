/**
 * routes: list of Kuzzle API exposed HTTP routes
 * accessControlAllowOrigin: sets the Access-Control-Allow-Origin header used to
 *   send responses to the client
 *   (see https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS)
 */

export type HttpConfiguration = {

  routes: any;
  /**
   * Sets the default Access-Control-Allow-Origin HTTP
   * header used to send responses to the client.
   *
   * @default "*"
   */
  accessControlAllowOrigin: string;

  /**
   * Sets the default Access-Control-Allow-Origin HTTP
   * header used to send responses to the client.
   *
   * @default false
   */
  accessControlAllowOriginUseRegExp: boolean;

  /**
   * Sets the default Access-Control-Allow-Method header.
   *
   * @default "GET,POST,PUT,DELETE,OPTIONS,HEAD"
   */
  accessControlAllowMethods: string;

  /**
   * Sets the default Access-Control-Allow-Headers.
   *
   * @default "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Encoding, Content-Length, X-Kuzzle-Volatile"
   */
  accessControlAllowHeaders: string;

  /**
   * Allows browser clients to connect to Kuzzle with cookies.
   *   /!\ This should not be allowed if the "http.accessControlAllowOrigin"
   *   configuration contains a wildcard ("*").
   * 
   * @default true
  */
  cookieAuthentication: boolean;
}
