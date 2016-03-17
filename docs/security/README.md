# Kuzzle Security

Kuzzle provides a full set of functionalities to finely define the permissions for your data.

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Fresh installation default rights.](#fresh-installation-default-rights)
- [Authentication](#authentication)
- [Permissions](#permissions)
  - [Users, profiles and roles](#users-profiles-and-roles)
  - [Roles definition](#roles-definition)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Fresh installation default rights.

When installing Kuzzle for the very first time, no default user is created and the Anonymous user is allowed to perform any action on the data. The only restriction is on the internal data storage used by Kuzzle to store its configuration.

Once a first admin user is created, either by accessing [Kuzzle Back Office](https://github.com/kuzzleio/kuzzle-bo) for the first time or by using the [CLI](https://github.com/kuzzleio/kuzzle/tree/master/bin), the Anonymous permissions are dropped.

You can then use the Back Office to administrate your user rights.

## Authentication

The first step to secure your data is to be able to identify your users. Kuzzle ships by default with a local login/password strategy.

You can also use Kuzzle's [Github authentication plugin](https://github.com/kuzzleio/kuzzle-plugin-auth-github) or [develop your own](./authentication.md).

## Permissions

Once you know who is connected, you need a way to attach your users some permission policies to control their access to data.

### Users, profiles and roles

Kuzzle associates `users` to a `profile`.  
You can think to a `profile` as a user group. All the `users` that share the same `profile` will get the same accesses.

Because some sets of permissions can be shared between several `profiles`, Kuzzle includes an additional level of abstraction below the `profile`: the `roles`.

A `profile` is a set of `role`. Each `role` defines a set of permissions.

![Users, profiles and roles](../images/kuzzle_security_readme_profiles-roles.png)

In the simple example above, the *editor* profile is a superset of the *contributor* one, which, in turn, extends the *default* profile.

### Roles definition

`roles` can be edited in [Kuzzle Back Office](https://github.com/kuzzleio/kuzzle-bo). A `role` definition is a hierarchical JSON object in which permissions can be defined at each data level, from the `index` down to the `action`.

Please refer to [the roles definition reference documentation](./roles-reference.md) for additional documentation on how to define `roles`.
