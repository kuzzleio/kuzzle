---
code: true
type: page
title: wrap | Framework | Core

description: BackendErrors wrap method
---

# wrap

<SinceBadge version="2.17.4" />

Returns helpers bound to a domain and a subdomain, so that the error name is the only thing left to give.

## Arguments

```ts
wrap (domain: string, subDomain: string): {
  get(error: string, ...placeholders: unknown[]): KuzzleError;
  getFrom(source: Error, error: string, ...placeholders: unknown[]): KuzzleError;
  reject(error: string, ...placeholders: unknown[]): Promise<never>;
}
```

| Argument    | Type              | Description    |
| ----------- | ----------------- | -------------- |
| `domain`    | <pre>string</pre> | Domain name    |
| `subDomain` | <pre>string</pre> | Subdomain name |

## Returns

Returns an object with three methods:

| Method    | Description                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| `get`     | Same as [get](/core/2/framework/classes/backend-errors/get), with the domain and subdomain already set              |
| `getFrom` | Same as [getFrom](/core/2/framework/classes/backend-errors/get-from), with the domain and subdomain already set      |
| `reject`  | Returns a promise rejected with the error that `get` would return                                                    |

An error name that is not registered in this domain and subdomain gives a `core.fatal.unexpected_error` error.

## Usage

```js
app.errors.register('app', 'api', 'custom', {
  class: 'BadRequestError',
  description: 'This is a custom error from API subdomain',
  message: 'Custom %s error',
});

const apiError = app.errors.wrap('app', 'api');

throw apiError.get('custom', 'Tbilisi');
```
