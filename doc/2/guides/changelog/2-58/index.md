---
code: false
type: page
order: 420
title: Kuzzle 2.58 | Changelog | Guide | Core
meta:
  - name: description
    content: What Kuzzle 2.58 changes, in plain words
  - name: keywords
    content: Kuzzle, Documentation, changelog, 2.58, TypeScript, kuzzle-types
---

# Kuzzle 2.58

**Released:** 2026-09-30. [GitHub release](https://github.com/kuzzleio/kuzzle/releases/tag/v2.58.0).

## In short

2.58 changes where Kuzzle's TypeScript types come from, without changing them.

## What you need to do

Nothing.

## What's new

- **Shared contract types.** The types that describe the API (documents, requests, responses, notifications…) now come from [`kuzzle-types`](https://github.com/kuzzleio/types), a types-only package that Kuzzle and the SDK share. Kuzzle exports the same names as before, and each type is identical to the one it replaces. This prepares Kuzzle 3, where the server will stop depending on the SDK for its own types (see [Towards Kuzzle 3](/core/2/guides/kuzzle-3)).
