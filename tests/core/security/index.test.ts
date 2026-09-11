import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` factories are hoisted above the module body, so everything they
// close over has to come from `vi.hoisted`.
const {
  calls,
  constructedWith,
  RoleRepositoryMock,
  ProfileRepositoryMock,
  TokenRepositoryMock,
  UserRepositoryMock,
  SecurityLoaderMock,
} = vi.hoisted(() => {
  const initCalls: string[] = [];
  /** Constructor arguments, recorded so the back-reference can be asserted
   * without reaching into a private/protected field. */
  const ctorArgs: Record<string, unknown> = {};

  function repositoryMock(name: string) {
    return class {
      constructor(module?: unknown) {
        ctorArgs[name] = module;
      }
      init = vi.fn(async () => {
        initCalls.push(name);
      });
    };
  }

  return {
    calls: initCalls,
    constructedWith: ctorArgs,
    RoleRepositoryMock: repositoryMock("role"),
    ProfileRepositoryMock: repositoryMock("profile"),
    TokenRepositoryMock: repositoryMock("token"),
    UserRepositoryMock: repositoryMock("user"),
    SecurityLoaderMock: repositoryMock("loader"),
  };
});

// roleRepository, userRepository and securityLoader ship `export =` (hence
// `default`); the profile and token repositories export their class by name.
vi.mock("../../../lib/core/security/roleRepository", () => ({
  default: RoleRepositoryMock,
}));
vi.mock("../../../lib/core/security/profileRepository", () => ({
  ProfileRepository: ProfileRepositoryMock,
}));
vi.mock("../../../lib/core/security/tokenRepository", () => ({
  TokenRepository: TokenRepositoryMock,
}));
vi.mock("../../../lib/core/security/userRepository", () => ({
  default: UserRepositoryMock,
}));
vi.mock("../../../lib/core/security/securityLoader", () => ({
  default: SecurityLoaderMock,
}));

import SecurityModule from "../../../lib/core/security";

describe("#core/security/SecurityModule", () => {
  let module: SecurityModule;

  beforeEach(() => {
    calls.length = 0;
    for (const key of Object.keys(constructedWith)) {
      delete constructedWith[key];
    }
    module = new SecurityModule();
  });

  /** The mocks stand in for the real classes, so the declared types differ. */
  const mock = (repo: unknown) =>
    repo as unknown as { init: ReturnType<typeof vi.fn> };

  describe("#constructor", () => {
    it("instantiates every repository and the loader", () => {
      expect(module.role).toBeInstanceOf(RoleRepositoryMock);
      expect(module.profile).toBeInstanceOf(ProfileRepositoryMock);
      expect(module.token).toBeInstanceOf(TokenRepositoryMock);
      expect(module.user).toBeInstanceOf(UserRepositoryMock);
      expect(module.loader).toBeInstanceOf(SecurityLoaderMock);
    });

    it("passes itself to the repositories that need to reach their siblings", () => {
      // userRepository reaches `module.profile` and `module.token`,
      // roleRepository reaches `module.profile` — that is what this wiring is for.
      expect(constructedWith.role).toBe(module);
      expect(constructedWith.profile).toBe(module);
      expect(constructedWith.user).toBe(module);
    });

    it("does not pass the module to the token repository or the loader", () => {
      // Neither reaches a sibling, and their constructors take no argument.
      expect(constructedWith.token).toBeUndefined();
      expect(constructedWith.loader).toBeUndefined();
    });
  });

  describe("#init", () => {
    it("initialises everything, role first and loader last", async () => {
      await module.init();

      for (const repo of [
        module.role,
        module.profile,
        module.token,
        module.user,
        module.loader,
      ]) {
        expect(mock(repo).init).toHaveBeenCalledOnce();
      }

      // The loader replays security fixtures through the API, so it must come
      // after the repositories it writes through.
      expect(calls).toEqual(["role", "profile", "token", "user", "loader"]);
    });

    it("rejects and stops at the first failure", async () => {
      // `profile.init()` is synchronous and no longer awaited (TD-26), so the
      // failure has to be thrown, not returned as a rejected promise.
      mock(module.profile).init = vi.fn().mockImplementation(() => {
        throw new Error("nope");
      });

      await expect(module.init()).rejects.toThrow("nope");
      expect(mock(module.token).init).not.toHaveBeenCalled();
      expect(mock(module.loader).init).not.toHaveBeenCalled();
    });
  });
});
