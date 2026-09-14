Feature: Stack traces never cross the wire

  # `removeStacktrace`'s own docstring says it "must be invoked by all
  # protocols" — an obligation stated in prose, spread over eight call sites in
  # four files, two of which are still JavaScript and are what sprint 6's H6 is
  # about to rewrite. Nothing asserted the outcome, so a conversion that drops
  # one of the eight failed nothing. ADR-0001, TD-48 (#2735).
  #
  # The scenarios address a node directly rather than nginx: the property holds
  # only outside development mode, where the stack is deliberately kept and
  # highlighted instead. `.ci/test-cluster-*.yml` runs one node with
  # NODE_ENV=production for exactly this.

  @http @stacktrace
  Scenario: An unexpected error over HTTP carries no stack
    When I send a HTTP "GET" request to "/tests/unexpected-error" on the production node
    Then The HTTP response status should be 500
    And The HTTP error id should be "plugin.runtime.unexpected_error"
    And The HTTP error carries no stack trace

  # Not the same code path as the scenario above: httpwsProtocol serves both
  # and sanitises them in different places (`:455` for HTTP, `:990` for the
  # WebSocket frame).
  @http @stacktrace
  Scenario: The same error over WebSocket carries no stack either
    When I query "tests":"unexpectedError" over WebSocket on the production node
    Then The WebSocket error carries no stack trace

  # Without this one, both assertions above would also pass against a response
  # that never had a stack to begin with — a renamed action, a wrong route, an
  # error raised before the handler. The development node keeps its stack, so
  # this scenario is what makes the other two mean anything.
  @http @stacktrace
  Scenario: The development node does carry one, so the assertions above are not vacuous
    When I send a HTTP "GET" request to "/tests/unexpected-error" on the development node
    Then The HTTP response status should be 500
    And The HTTP error carries a stack trace

  @http @stacktrace
  Scenario: The same control over WebSocket
    When I query "tests":"unexpectedError" over WebSocket on the development node
    Then The WebSocket error carries a stack trace
