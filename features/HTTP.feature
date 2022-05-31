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
      | headers.connection                   | "close"       |
      | headers.x-kuzzle-request-id          | "_STRING_"    |
      | headers.x-kuzzle-node                | "_STRING_"    |
      | headers.access-control-allow-headers | "_STRING_"    |
      | headers.access-control-allow-methods | "_STRING_"    |
      | headers.foo                          | "bar"         |
      | headers.alpha                        | "beta"        |
    Then The response headers in the body should be equal:
      | foo   | "bar"  |
      | alpha | "beta" |