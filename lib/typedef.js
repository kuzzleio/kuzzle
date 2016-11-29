/**
 * @typedef {{
 *   id: string,
 *   timestamp: number,
 *   status: number,
 *   error: object,
 *   result: *,
 *   input: RequestObject,
 *   context: RequestContext|{
 *     token: Token,
 *     user: User,
 *     connectionId: string,
 *     protocol: string
 *   }
 * }} KuzzleRequest
 */