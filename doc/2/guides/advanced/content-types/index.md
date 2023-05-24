---
code: false
type: page
order: 900
title: Additional Content Types | Kuzzle Advanced | Guide | Core
meta:
  - name: description
    content: Support additional content types
  - name: keywords
    content: Kuzzle, Documentation, kuzzle write pluggins, General purpose backend, opensource, content-type, iot, backend
---

# Additional Content Types

<SinceBadge version="2.25.0" />

By default, Kuzzle supports common HTTP content types like JSON and form data.

However, there may be cases where you need to support additional content types such as YAML.

This documentation guide will explain how to extend Kuzzle's capabilities to handle custom content types.

## Configuring Kuzzle

The `server.protocols.http.additionalContentTypes` configuration setting in the [kuzzlerc configuration file](/core/2/guides/advanced/configuration) allows you to specify additional content types that Kuzzle should support.

It takes an array of strings, where each string represents a content type.

```javascript
"server": {
  "protocols": {
    "http": {
      // Enables Kuzzle to accept additional Content-Types.
      // Note: This relies on the implementation of a
      // "protocol:http:beforeParsingPayload" pipe that implements
      // the formatting of the additional content types to JSON.
      "additionalContentTypes": [
        "application/x-yaml"
      ]
    }
  }
}
```

:::info
The default content types are:

- application/json
- application/x-www-form-urlencoded
- multipart/form-data
:::

## Implementing the `protocol:http:beforeParsingPayload` pipe

To convert the payload of the custom content type to a format that Kuzzle can handle (e.g., JSON), you need to implement the `protocol:http:beforeParsingPayload` pipe.

This pipe intercepts the incoming HTTP request, allowing you to modify the payload before Kuzzle parses it.

The `protocol:http:beforeParsingPayload` pipe is a function that takes an object as an argument, containing two properties:

- `message`: An object of type HttpMessage, containing information about the HTTP request.
- `payload`: A Buffer containing the raw payload data.

Your implementation should return an object containing a single `payload` property, which holds the converted payload.

Here's an example implementation of the `protocol:http:beforeParsingPayload` pipe, converting YAML to JSON:

```typescript
const yamlToJsonPipe = ({
  message,
  payload,
}: {
  message: HttpMessage;
  payload: Buffer;
}): { payload: string } => {
  if (message.headers["content-type"] !== "application/x-yaml") {
    return { payload };
  }

  const convertedPayload = YAML.parse(payload.toString());

  return { payload: JSON.stringify(convertedPayload) };
};
```

That pipe can then be registered in your backend:

```typescript
app.pipe.register("protocol:http:beforeParsingPayload", yamlToJsonPipe);
```
