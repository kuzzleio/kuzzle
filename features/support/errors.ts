/**
 * What these steps read off a rejection.
 *
 * A `catch` clause receives `unknown`, and everything the suite catches is
 * either a `KuzzleError` from the SDK — which carries `id` and `status` — or a
 * `request-promise` failure, which nests the API's answer under `error`. The
 * guard below claims no more than "this is an object": every field stays
 * optional, so reading one is a question rather than an assertion, and a
 * rejection that is not an object at all takes the `else` branch instead of
 * throwing `Cannot read properties of undefined`.
 */
export type ApiError = {
  error?: { error?: unknown };
  id?: string;
  status?: number;
};

export function isApiError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null;
}
