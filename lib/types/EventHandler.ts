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
  payload: any;

  /**
   * Result of the event
   */
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
 * Handler for cluster event.
 */
export type ClusterEventHandler<
  TEventDefinition extends EventDefinition = EventDefinition,
> = (...args: TEventDefinition["args"]) => any;

/**
 * Handler for ask event.
 */
export type AskEventHandler<
  TAskEventDefinition extends AskEventDefinition = AskEventDefinition,
> = (
  ...args: [payload?: TAskEventDefinition["payload"], ...rest: any[]]
) => Promise<TAskEventDefinition["result"]> | TAskEventDefinition["result"];

/**
 * Handler for call event.
 */
export type CallEventHandler<
  TAskEventDefinition extends AskEventDefinition = AskEventDefinition,
> = (
  ...args: [payload?: TAskEventDefinition["payload"], ...rest: any[]]
) => TAskEventDefinition["result"];

/**
 * @deprecated Use HookEventHandler, PipeEventHandler or ClusterEventHandler
 */
export type EventHandler = (...payload: any) => any;
