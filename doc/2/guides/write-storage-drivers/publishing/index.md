---
code: false
type: page
order: 500
title: Publish a driver | Write storage drivers | Guide
meta:
  - name: description
    content: Version, publish and document a Kuzzle storage driver
  - name: keywords
    content: Kuzzle, Documentation, storage driver, publish, npm, versioning
---

# Publish a Driver

<SinceBadge version="2.61.0" />

## Versions

- **The driver's own version** follows semver, like any package: a change of behaviour visible to applications is a
  major.
- **`kuzzleVersion`** in `manifest.json` is the range of Kuzzle versions the driver supports. Kuzzle reads it before
  loading the code, and refuses to start out of it
  ([services.storage_driver.version_mismatch](/core/2/api/errors/error-codes/services)). The contract stays backward
  compatible within a Kuzzle major: `">=2.61.0-0 <3"` is the usual range for Kuzzle 2.
- **The peer dependency** on `kuzzle` states the same range, so that npm warns about an incompatible install.

## Publish

Publish to npm as `kuzzle-storage-<engine>-<major>`, where `<major>` is the engine's major version: an engine's next
major gets a new package, so that an application chooses its engine version by choosing the package. Ship `dist/`,
`manifest.json`, the README and the licence; check with `npm pack --dry-run`.

The Elasticsearch drivers publish with semantic-release, from `beta` (prereleases) and `master` (stable), through
npm's trusted publishing: their `.github/workflows/release.yaml` is a working example.

## Clusters

Every node of a Kuzzle cluster must run the same driver, in the same version: a node running another one is refused
when it joins ([cluster.join.storage_driver_mismatch](/core/2/api/errors/error-codes/cluster)). Say so in your
documentation: upgrading the driver means restarting the whole cluster, not a rolling restart.

## Document it

Document at least the install, the configuration your driver reads, the engine versions it supports and its
capabilities. Official drivers have their own section on this site, [Drivers](/drivers/v2.html), built from the
`doc/1/` directory of their repository.
