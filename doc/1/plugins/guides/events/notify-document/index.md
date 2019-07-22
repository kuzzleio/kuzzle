---
code: true
type: page
title: notify:document
---

# notify:document



| Arguments | Type                                                                      | Description                           |
| --------- | ------------------------------------------------------------------------- | ------------------------------------- |
| `message` | [`Notification`](/core/1/api/essentials/notifications/) | The normalized real-time notification |

Triggered whenever a real-time document notification is about to be sent.

A [pipe](/core/1/plugins/guides/pipes/) can block some (or all) notifications by rejecting the provided promise.
