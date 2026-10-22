/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Describe an event with it's name and the handler function arguments
 */
export type EventDefinition = {
  /**
   * Name of the event
   *
   * @example
   * "core:document:create:after"
   */
  name: string;

  /**
   * Arguments of the event
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  args: any[];
};

/**
 * Describe an ask event with it's name and the payload and result types
 */
export type AskEventDefinition = {
  /**
   * Name of the event
   *
   * @example
   * "core:document:create"
   */
  name: string;

  /**
   * Payload of the event
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  payload: any;

  /**
   * Result of the event
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  result: any;
};

/**
 * Handler for hook events
 */
export type HookEventHandler<
  TEventDefinition extends EventDefinition = EventDefinition,
> = (...args: TEventDefinition["args"]) => Promise<void> | void;

/**
 * Handler for pipe event.
 *
 * It should return a promise resolving the first received argument.
 */
export type PipeEventHandler<
  TEventDefinition extends EventDefinition = EventDefinition,
> = (...args: TEventDefinition["args"]) => Promise<TEventDefinition["args"][0]>;

/**
 * A plugin pipe in its **callback** form: instead of answering a promise it
 * takes a trailing `callback(error, result)`. The pipe runner supports both,
 * and `PluginsManager.registerPipe` always hands over this one.
 */
export type CallbackPipeHandler = (...args: unknown[]) => void;

/**
 * What the emitter actually stores for a plugin pipe: either form.
 */
export type RegisteredPipeHandler<
  TEventDefinition extends EventDefinition = EventDefinition,
> = PipeEventHandler<TEventDefinition> | CallbackPipeHandler;

/**
 * Handler for cluster event.
 */
export type ClusterEventHandler<
  TEventDefinition extends EventDefinition = EventDefinition,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
> = (...args: TEventDefinition["args"]) => any;

/**
 * Handler for ask event.
 */
export type AskEventHandler<
  TAskEventDefinition extends AskEventDefinition = AskEventDefinition,
> = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  ...args: [payload?: TAskEventDefinition["payload"], ...rest: any[]]
) => Promise<TAskEventDefinition["result"]> | TAskEventDefinition["result"];

/**
 * Handler for call event.
 */
export type CallEventHandler<
  TAskEventDefinition extends AskEventDefinition = AskEventDefinition,
> = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  ...args: [payload?: TAskEventDefinition["payload"], ...rest: any[]]
) => TAskEventDefinition["result"];

/**
 * @deprecated Use HookEventHandler, PipeEventHandler or ClusterEventHandler
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
export type EventHandler = (...payload: any) => any;
