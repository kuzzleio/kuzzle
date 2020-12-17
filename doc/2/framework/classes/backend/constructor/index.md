---
code: false
type: page
title: Constructor
description: Backend class constructor
---

# Backend

<SinceBadge version="2.8.0" />
<CustomBadge type="error" text="Experimental: non-backward compatible changes or removal may occur in any future release."/>

The `Backend` class is the **entry point** of a Kuzzle application.  

It must be instantiated in order to create a new application.  

It gives access to the different features of the framework through its properties.

---

## Constructor

```js
new Backend(name)
```

<br/>

| Arguments           | Type              | Description                                                                                                                     |
| ------------------- | ----------------- | ---------------- |
| `name`              | <pre>string</pre> | Application name |
