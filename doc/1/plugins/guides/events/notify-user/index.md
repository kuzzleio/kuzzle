---
code: true
type: page
title: notify:user
---

# notify:user



| Arguments | Type                                                                      | Description                           |
| --------- | ------------------------------------------------------------------------- | ------------------------------------- |
| `message` | [`Notification`](/core/1/api/essentials/notifications) | The normalized real-time notification |

Triggered whenever a real-time user notification is about to be sent.

A [pipe](/core/1/plugins/guides/pipes/) can block some (or all) notifications by rejecting the provided promise.
