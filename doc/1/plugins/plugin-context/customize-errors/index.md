---
code: true
type: page
title: customize errors
---

# Customize errors

When creating a Kuzzle plugin, custom [API errors](https://docs.kuzzle.io/core/1/api/essentials/errors/) can be defined and thrown, using the `errorsManager`.

Custom errors have to be written in the [manifest.json](https://docs.kuzzle.io/core/1/plugins/guides/manual-setup/prerequisites/#manifest-json), in an `errors` field.

Example:
```
{
    "name": "<plugin name>",
    "kuzzleVersion": ">=1.0.0 <2.0.0",
    "errors": {
        "some_error": {
            "code": 1,
            "message": "Some error occurred: %s",
            "class": "BadRequestError"
	},
        "some_other_error": {
            "code": 2,
            "message": "Some other error occurred: %s",
            "class": "ForbiddenError"
	}
    }
}
```

It is exposed as `errorsManager` in the [PluginContext](https://docs.kuzzle.io/core/1/plugins/plugin-context/accessors/intro/).
The `errorsManager` provides two functions:
- To throw : `context.errorsManager.throw(error, placeholders);`.
- To get the built error: `context.errorsManager.get(error, placeholders);`

Note that the `domain` is `plugins`, meaning that its code is fixed to `04` and cannot be changed.
By default, the [subdomain](https://docs.kuzzle.io/core/1/plugins/plugin-context/errors/kuzzleerror/) code for plugins is set to `0`. A subdomain can be defined for a plugin in its configuration section in the [kuzzlerc file](https://docs.kuzzle.io/core/1/plugins/guides/manual-setup/config/). 

Example, for a plugin name `foobar-plugin`:

```
{
  "plugins": {
    "foobar-plugin": {
      "option_1": "option_value",
      "option_2": "option_value",
      "_pluginCodes": {
          "foobar-plugin" : 42
      }
    }
  }
}
```

## Example

If you customize errors like above and you write `context.errorsManager.throw('some_error', 'Something get wrong');`, Kuzzle will throw a [BadRequestError](https://docs.kuzzle.io/core/1/api/essentials/errors/#badrequesterror) with the following properties :

- message : `Some error occured: Something get wrong`
- errorName : `plugins.foobar-plugin.some_error`
- code : 0442123
