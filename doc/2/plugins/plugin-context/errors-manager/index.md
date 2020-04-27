---
code: true
type: page
title: errorsManager
---

# Errors Manager

When creating a Kuzzle plugin, custom [API errors](/core/2/api/essentials/error-codes) can be defined and thrown, using the `errorsManager`.

Custom errors have to be specified in the [manifest.json](/core/2/plugins/guides/manual-setup/prerequisites/#manifest-json), in an `errors` field.

Example:
```
{
  "name": "<plugin name>",
  "kuzzleVersion": ">=2.0.0 <3.0.0",
  "errors": {
    "some_error": {
      "code": 1,
      "message": "An error occurred: %s",
      "class": "BadRequestError"
	},
    "some_other_error": {
      "code": 2,
      "message": "An other error occurred: %s",
      "class": "ForbiddenError"
	}
}
```

The `errorsManager` exposes 4 functions:
  - `get(errorId, ...placeholders)`: Returns the corresponding error
  - `getFrom(error, errorId, ...placeholders)`: Returns the corresponding error derived from a previous one (eg: to keep the stacktrace)
  - `reject(errorId, ...placeholders)`: Like `get(...)` but returns a rejected promise
  - `rejectFrom(error, errorId, ...placeholders)`: Like `getFrom(...)` but returns a rejected promise

Note that the `domain` is `plugins`, meaning that its code is fixed to `04` and cannot be changed.
By default, the [subdomain](/core/2/plugins/plugin-context/errors/kuzzleerror/) code for plugins is set to `0`. A subdomain can be defined for a plugin in its configuration section in the [kuzzlerc file](/core/2/plugins/guides/manual-setup/config/). 

Example, for a plugin name `foobar-plugin`:

```
{
  "plugins": {
    "foobar-plugin": {
      "option_1": "option_value",
      "option_2": "option_value",
      "_pluginCode": 42
      }
    }
  }
}
```

## Example

Taking the configuration example above, if an error is thrown like this:

`throw context.errorsManager.get('some_error', 'request badly formatted');`

Then when triggered on an API request, Kuzzle will respond to the querying user with a [BadRequestError](/core/2/api/essentials/error-handling/#badrequesterror) error, with the following properties:

- message : `An error occured: request badly formatted`
- id : `plugin.foobar-plugin.some_error`
- code : 0x04020033
