/**
 * Calls an SDK controller method whose name a feature file supplies, e.g.
 * `I "mCreate" the following multiple documents:`.
 *
 * `controller[action](...)` with a `string` action is `any` under `strict`: no
 * controller has an index signature. Reading the method with `Reflect.get` and
 * calling it with `Reflect.apply` keeps the receiver — hoisting an indexed read
 * out of its call site is what drops it — and a name the controller does not
 * have fails here, by name, instead of as `... is not a function`.
 */
export function invokeAction(
  controller: object,
  action: string,
  ...args: unknown[]
): Promise<unknown> {
  const method: unknown = Reflect.get(controller, action);

  if (typeof method !== "function") {
    throw new Error(`${controller.constructor.name} has no action "${action}"`);
  }

  return Reflect.apply(method, controller, args);
}
