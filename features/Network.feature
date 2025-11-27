Feature: Network

  @network @http
  Scenario: Streamed responses use chunked encoding without content length
    When I send a raw HTTP "GET" request to "/stream-test/download-chunked" on port 17510 with headers:
      | Connection | "close" |
    Then The raw HTTP response headers should match:
      | content-length    | undefined |
      | transfer-encoding | "chunked" |

  @network @http
  Scenario: Fixed size streams expose a content length
    When I send a raw HTTP "GET" request to "/stream-test/download-fixed" on port 17510 with headers:
      | Connection | "close" |
    Then The raw HTTP response headers should match:
      | content-length    | "10"      |
      | transfer-encoding | undefined |

  @network @http
  Scenario: Accepts additional content types
    When I send a HTTP "POST" request to "http://localhost:17510/_/functional-tests/hello-world" with headers and body:
      | Content-Type | "application/x-yaml" |
    Then The HTTP response JSON should match:
      | result | { "greeting": "Hello, Martial" } |

  @network
  Scenario: Healthcheck endpoint returns status
    When I send a raw HTTP "GET" request to "/_healthcheck" on port 7512
    Then The HTTP response JSON should match:
      | status | 200 |

  @network
  Scenario: Ready endpoint returns 200 when healthy
    When I send a HTTP "GET" request to "http://localhost:17510/_ready"
    Then The HTTP response status should be 200

  @network
  Scenario: Ready endpoint returns 503 when node not started
    When I send a HTTP "GET" request to "http://localhost:17510/tests/simulate-outage?type=nodeNotStarted"
    Then The HTTP response status should be 200
    When I send a HTTP "GET" request to "http://localhost:17510/_ready"
    Then The HTTP response status should be 503
    When I send a HTTP "GET" request to "http://localhost:17510/tests/clear-outage"
    Then The HTTP response status should be 200

  @network
  Scenario: Ready endpoint returns 503 when overloaded
    When I send a HTTP "GET" request to "http://localhost:17510/tests/simulate-outage?type=overload"
    Then The HTTP response status should be 200
    When I send a HTTP "GET" request to "http://localhost:17510/_ready"
    Then The HTTP response status should be 503
    When I send a HTTP "GET" request to "http://localhost:17510/tests/clear-outage"
    Then The HTTP response status should be 200
