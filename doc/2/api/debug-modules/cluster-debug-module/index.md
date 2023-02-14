---
code: false
type: page
title: Cluster
description: Cluster debug module
order: 100
---

# Cluster

The Cluster debug module is a module that extends the capabilities of the [Debug Controller](/core/2/api/controllers/debug)
and helps debugging the nodes and state of the Cluster.

## Summary

| Method name                                 | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| [preventNodeEviction](#preventnodeeviction) | Enable or disable the node eviction on the current node |

## Methods

### preventNodeEviction

Enable or disable the node eviction prevention on the current node of the cluster.
This might be usefull when the node gets slow while debugging.

**Parameters**

| Parameter name | Type      | Description                                     |
| -------------- | --------- | ----------------------------------------------- |
| enabled        | `boolean` | Enables or disable the node eviction prevention |