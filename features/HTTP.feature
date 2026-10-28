Feature: HTTP

  @http
  Scenario: Check no default headers in body and verify no leakage of set-cookie
    When I send a HTTP "POST" request with:
      | controller | "tests"           |
      | action     | "sendBodyHeaders" |
    Then The raw response should match:
      | headers.set-cookie                   | [ "foo=bar" ] |
      | headers.content-type                 | "_STRING_"    |
      | headers.content-length               | "_STRING_"    |
      | headers.content-encoding             | "_STRING_"    |
      | headers.connection                   | "_STRING_"    |
      | headers.x-kuzzle-request-id          | "_STRING_"    |
      | headers.x-kuzzle-node                | "_STRING_"    |
      | headers.access-control-allow-headers | "_STRING_"    |
      | headers.access-control-allow-methods | "_STRING_"    |
      | headers.foo                          | "bar"         |
      | headers.alpha                        | "beta"        |
    Then The response headers in the body should be equal:
      | foo   | "bar"  |
      | alpha | "beta" |

  # These routes outlived their actions (removed in Kuzzle 2.0, or never
  # mapped to Redis): they could only fail, with `api.process.action_not_found`
  # or a rights error, and were listed in the OpenAPI definition.
  @http
  Scenario Outline: Routes to removed actions are unknown URLs
    When I send a HTTP "<verb>" request to "http://localhost:17510<path>"
    Then The HTTP response status should be 404
    And The HTTP response JSON should match:
      | error | { "id": "network.http.url_not_found" } |

    Examples:
      | verb | path                        |
      | POST | /admin/_resetKuzzleData     |
      | GET  | /nyc-open-data/_autoRefresh |
      | POST | /ms/_bgsave                 |
      | POST | /ms/_bgrewriteaof           |
