---
code: true
type: page
title: contructor | Framework | Core

description: Repository constructor method
---

# `constructor`

```js
new Repository(collection: string, ObjectConstructor?: new (...any) => any): Repository;
```

<br/>

| Arguments           | Type              | Description                                                                                                                     |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `collection`        | <pre>string</pre> | The repository's collection to link to this class instance                                                                      |
| `ObjectConstructor` | <pre>new (...any) =&gt; any</pre> | If an `ObjectConstructor` class is provided, fetched data will be returned as instances of that class, instead of plain objects |
