// Flat config: `.eslintrc.json` and the `plugin:kuzzle/*` syntax are gone with
// eslint-plugin-kuzzle 2.0.0 (ESLint 9 dropped eslintrc support). The
// per-directory `.eslintrc.json` files (features, features-legacy — and, until
// step 13's L7 deleted the Mocha suite, test) and `.eslintignore` are folded in
// here — flat config is one file, top to bottom, last block wins.
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import kuzzle from "eslint-plugin-kuzzle";

// The package's root barrel, `index.ts`, with and without extension; the
// directory itself resolves to it too.
const rootDir = dirname(fileURLToPath(import.meta.url));
const rootBarrel = new Set(
  ["", "index", "index.ts", "index.js"].map((f) => resolve(rootDir, f)),
);

// Rules local to this repository, too small to be worth a plugin package.
const local = {
  rules: {
    // ADR-0001, TD-49 (kuzzle#3012): the root barrel re-exports most of lib/,
    // so a module of lib/ importing it drags the whole backend into its import
    // graph, in a cycle. The specifier is resolved against the importing file:
    // a pattern cannot tell `../../../index` (the root) from `../index`.
    "no-root-barrel-import": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          rootBarrel:
            '"{{source}}" is the package\'s root index.ts: import the module that defines the symbol instead. (ADR-0001, TD-49)',
        },
      },
      create(context) {
        const dir = dirname(context.filename);

        function check(source) {
          if (
            source?.type === "Literal" &&
            typeof source.value === "string" &&
            source.value.startsWith(".") &&
            rootBarrel.has(resolve(dir, source.value))
          ) {
            context.report({
              data: { source: source.value },
              messageId: "rootBarrel",
              node: source,
            });
          }
        }

        return {
          CallExpression(node) {
            if (
              node.callee.type === "Identifier" &&
              node.callee.name === "require"
            ) {
              check(node.arguments[0]);
            }
          },
          ExportAllDeclaration: (node) => check(node.source),
          ExportNamedDeclaration: (node) => check(node.source),
          ImportDeclaration: (node) => check(node.source),
          ImportExpression: (node) => check(node.source),
          TSExternalModuleReference: (node) => check(node.expression),
        };
      },
    },

    // ADR-0001, TD-08: `lib/types/` mixed `foo.type.ts` and `Foo.ts`. A file
    // there is named after the type it declares, in PascalCase.
    "types-file-name": {
      meta: {
        type: "suggestion",
        schema: [],
        messages: {
          pascalCase:
            '"{{name}}": files under lib/types/ are named after the type they declare, in PascalCase (Token.ts, ControllerDefinition.ts). (ADR-0001, TD-08)',
        },
      },
      create(context) {
        return {
          Program(node) {
            const name = basename(context.filename);

            if (!/^[A-Z][A-Za-z0-9]*\.ts$/u.test(name)) {
              context.report({ data: { name }, messageId: "pascalCase", node });
            }
          },
        };
      },
    },
  },
};

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
      // An error everywhere but in the test trees, which the block below
      // keeps at `warn` (ADR-0001, TD-02 — kuzzle#2968). An `any` kept on
      // the public boundary for compatibility is disabled on its line and
      // listed in docs/v3-breaking-changes.md.
      "@typescript-eslint/no-explicit-any": "error",
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

  // Still advisory in the test trees (162 occurrences when lib/ went to
  // `error`): mocks and fixtures, typed in a follow-up. `*.ts` only: the
  // typescript-eslint plugin is only registered for TypeScript files.
  {
    files: ["tests/**/*.ts", "features/**/*.ts", "features-legacy/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  {
    files: ["lib/types/**/*.ts"],
    ignores: [
      // The barrel.
      "lib/types/index.ts",
      // @deprecated re-exports at the pre-TD-08 paths, kept for deep imports
      // of `dist/lib/...`; removed in v3 (docs/v3-breaking-changes.md).
      "lib/types/controllers/adminController.type.ts",
      "lib/types/controllers/authController.type.ts",
      "lib/types/core/auth/formatProcessing.type.ts",
    ],
    plugins: { local },
    rules: { "local/types-file-name": "error" },
  },

  // Entry points outside lib/ (bin/, the tests) may import the root barrel.
  {
    files: ["lib/**"],
    plugins: { local },
    rules: { "local/no-root-barrel-import": "error" },
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
