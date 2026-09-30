// `should` ships `should.d.ts` for its main entry only, and that entry extends
// `Object.prototype` on import. The `as-function` subpath is the same API without
// the prototype extension, which is what a test entrypoint wants — but it carries
// no declaration, so importing it is an implicit `any` under `strict`.
//
// Declared here rather than in `lib/types/` because `should` is a test dependency:
// it outlived the Mocha suite as cucumber's assertion library (ADR-0001 step 13,
// L7a), and nothing in `lib/` may import it.
declare module "should/as-function" {
  import should = require("should");

  export = should;
}
