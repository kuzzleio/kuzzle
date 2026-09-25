/**
 * A controller action reading its request the way the API reference
 * documents it: the getters, the user and token, the response.
 */

import type { JSONObject, KuzzleRequest } from "kuzzle";
import { Backend } from "kuzzle";

const app = new Backend("typings");

async function handler(request: KuzzleRequest) {
  const body = request.getBody();
  const bodyOrDefault = request.getBody({ default: true });
  const name = request.getString("name");
  const nameOrDefault: string = request.getString("name", "default");
  const age = request.getInteger("age");
  const flag = request.getBoolean("flag");
  const tags = request.getArray("tags");
  const filter = request.getObject("filter", {});

  // TY-03: literal and non-literal options alike, read as a `string`.
  const id = request.getId();
  const generated: string = request.getId({ ifMissing: "generate" });
  const ignored: string = request.getId({ ifMissing: "ignore" });
  const mode = request.input.args.mode as "error" | "generate" | "ignore";
  const dynamicId: string = request.getId({ ifMissing: mode });
  const index: string = request.getIndex();
  const collection: string = request.getCollection();
  const required = Boolean(request.input.args.strict);
  const dynamicIndex: string = request.getIndex({ required });
  const optionalCollection: string = request.getCollection({
    required: false,
  });
  const both = request.getIndexAndCollection();

  // TY-06: the controller, the action, the user and the token.
  const controller: string = request.getController();
  const action: string = request.getAction();
  const user = request.getUser();
  const userId: string = request.getUser()._id;
  const profileIds: string[] = request.getUser().profileIds;
  const kuid: string | null = request.getKuid();
  const token = request.context.token;
  const tokenUserId: string | undefined = token?.userId;
  const jwt: string | undefined = token?.jwt;
  const expiresAt: number | undefined = token?.expiresAt;
  const connectionId: string | null = request.context.connection.id;

  const pojo = request.pojo();
  const pojoController: string = pojo.input.controller;
  const pojoAction: string = pojo.input.action;
  const pojoUserId: string = pojo.context.user._id;
  const pojoBody: JSONObject = pojo.input.body;

  request.response.configure({
    format: "raw",
    headers: { "X-Foo": "bar" },
    status: 200,
  });
  request.response.setHeader("X-Bar", "baz");
  request.setResult({ ok: true }, { headers: { a: "b" }, status: 200 });
  request.addDeprecation("2.0.0", "deprecated");

  return {
    action,
    age,
    body,
    bodyOrDefault,
    both,
    collection,
    connectionId,
    controller,
    dynamicId,
    dynamicIndex,
    expiresAt,
    filter,
    flag,
    generated,
    id,
    ignored,
    index,
    jwt,
    kuid,
    name,
    nameOrDefault,
    optionalCollection,
    pojoAction,
    pojoBody,
    pojoController,
    pojoUserId,
    profileIds,
    tags,
    tokenUserId,
    user,
    userId,
  };
}

app.controller.register("reader", { actions: { read: { handler } } });
