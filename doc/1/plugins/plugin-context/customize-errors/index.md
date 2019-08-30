---
code: true
type: page
title: customize errors
---

# Customize errors

When creating a Kuzzle plugin, custom API errors can be defined and thrown, using the `errorsManager` accessor.

Custom errors have to be written in the [manifest.json](https://docs.kuzzle.io/core/1/plugins/guides/manual-setup/prerequisites/#manifest-json), in an `errors` field.

Your manifest would be something like :
```
{
    "name": "kuzzle-plugin-xxx",
    "kuzzleVersion": ">=1.0.0 <2.0.0",
    "privileged": false,
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

Also, you can give more precision by giving a [`subdomain`](https://docs.kuzzle.io/core/1/plugins/plugin-context/errors/kuzzleerror/) to your plugin in you [kuzzlerc file](https://docs.kuzzle.io/core/1/plugins/guides/manual-setup/config/). It would be like :

```
{
  "plugins": {
    "foobar-plugin": {
      "option_1": "option_value",
      "option_2": "option_value",
      "codes": {
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
