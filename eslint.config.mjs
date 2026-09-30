// Flat config: `.eslintrc.json` and the `plugin:kuzzle/*` syntax are gone with
// eslint-plugin-kuzzle 2.0.0 (ESLint 9 dropped eslintrc support). The
// per-directory `.eslintrc.json` files (features, features-legacy — and, until
// step 13's L7 deleted the Mocha suite, test) and `.eslintignore` are folded in
// here — flat config is one file, top to bottom, last block wins.
import kuzzle from "eslint-plugin-kuzzle";

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      // Generated from the .ts sources; never hand-edited.
      "**/*.d.ts",
      "**/*.js.map",
    ],
  },

  ...kuzzle.configs.default,
  ...kuzzle.configs.node,

  // `configs.typescript` used to be an `overrides` block scoped to `*.ts`.
  // Spread as-is it would apply to every file, and the CommonJS JavaScript the
  // repo still carries on purpose — the three plugin fixtures under
  // `bin/plugins/available/**`, which are the `js` ratchet's floor — would each
  // take a `no-require-imports` error for a `require()` that is correct there.
  ...kuzzle.configs.typescript.map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),

  // Flat config defaults `.js` to `sourceType: "module"`, under which the
  // `strict` rule forbids the `"use strict"` directive our CommonJS files
  // carry. Every `.js` left in the repo is CommonJS (ADR-0001 migrated them to
  // TypeScript, not to ESM; what remains is the plugin-fixture floor).
  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "commonjs" },
  },

  // Advisory in the shared config since 2.0.0; kept explicit so a future
  // default change does not silently promote them to errors.
  {
    rules: {
      "sort-keys": "warn",
      "kuzzle/array-foreach": "warn",
    },
  },

  {
    files: ["**/*.ts"],
    rules: {
      // ADR-0001, TD-49: a type-only import that looks like a value import
      // decides what the emitted JS requires at load time.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
          minimumDescriptionLength: 20,
        },
      ],
    },
  },

  {
    files: ["tests/**", "features/**", "features-legacy/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[arguments.length=0][callee.type='MemberExpression'][callee.property.name=/^(throw|throwError)$/]:not([callee.object.property.name='not'])",
          message:
            'should(fn).throw() with no matcher is not a test of why — assert the error type, message or id. In a function whose control flow is four asserts, "it threw" is what every path has in common. (ADR-0001, TD-57)',
        },
        {
          selector:
            "CallExpression[arguments.length=0][callee.type='MemberExpression'][callee.property.name=/^toThrow(Error)?$/]:not([callee.object.property.name='not'])",
          message:
            "expect(fn).toThrow() with no matcher is not a test of why — pass the expected error, message or a matcher object. (ADR-0001, TD-57)",
        },
        {
          // Cucumber types a step's `this` as a world with an index signature,
          // so an un-annotated step compiles whatever it reads off `this`.
          // Harmless in tests/, which registers no cucumber step.
          selector:
            "CallExpression[callee.name=/^(Given|When|Then|Before|After|BeforeStep|AfterStep|defineStep)$/] > :matches(FunctionExpression:not([params.0.name='this']), ArrowFunctionExpression)",
          message:
            "Declare the world: `function (this: KuzzleWorld, ...)` in features/, `this: KWorld` in features-legacy/. Without it `this` is cucumber's IWorld, whose index signature types every read as `any`. (ADR-0001, step 14 M3b)",
        },
      ],
    },
  },

  // Was features/.eslintrc.json and features-legacy/.eslintrc.json, which were
  // identical.
  {
    files: ["features/**", "features-legacy/**"],
    rules: {
      "func-names": "off",
      "no-invalid-this": "off",
      "no-console": "off",
      "no-new": "off",
      "new-cap": "off",
    },
  },
];
