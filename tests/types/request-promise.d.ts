// `request-promise` and its `request` core were deprecated in 2020 and ship no
// declarations. Three files in the functional suites import it — this one, and
// two `features/` step definitions — and nothing in `lib/` does, which is why
// the declaration lives here rather than in `lib/types/`.
//
// Deliberately narrow: the whole of the suites' use is `rp(options)` answering
// the response body, with the request module's own option bag passed through.
// Declaring more would be describing a library nobody here calls.
declare module "request-promise" {
  // `url` and `uri` are the same option under two names, and both are in use
  // here: `features-legacy/support/api/http.ts` passes `url`,
  // `features/step_definitions/network-step.ts` passes `uri`. Neither is
  // required *by the declaration* — requiring one of the two is expressible and
  // is not worth the noise for three call sites.
  interface RequestPromiseOptions {
    url?: string;
    uri?: string;
    method?: string;
    [option: string]: unknown;
  }

  function rp(options: RequestPromiseOptions): Promise<any>;

  export = rp;
}
