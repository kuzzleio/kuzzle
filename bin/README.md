# Managing Kuzzle

```
$ kuzzle install
```

Installs plugins declared in Kuzzle `.kuzzlerc` configuration file.  

```
$ kuzzle start
```

Starts a Kuzzle instance in the foreground.

# Create the first administrative user account

This is a recommended first step to secure your Kuzzle Backend

```
$ kuzzle createFirstAdmin
```

This command will guide you through the creation process of the first admin user and fix the rights to other user types if needed.

**Note:** This command is interactive and let you choose whether you want to apply the default secured roles and profiles or not

# Reset Kuzzle

```
$ kuzzle reset
```

will allow you to reset Kuzzle and restore it as if it is freshly installed.


## Reset and add fixtures or mappings

You can perform a reset followed by a fixtures and/or mappings import by doing:

```
$ kuzzle reset --fixtures /path/to/the/fixtures/file.json --mappings /path/to/the/mappings/file.json
```

## Reset the Kuzzle Backend from a script or cron

```
$ kuzzle reset --noint
```

# Getting help

You can, of course, get some help by using the --help option.

Try those:

```
$ kuzzle --help
$ kuzzle start --help
$ kuzzle reset --help
```
