"use strict";

const mockrequire = require("mock-require");
const rewire = require("rewire");
const sinon = require("sinon");
const should = require("should");

const { PreconditionError } = require("../../index");
const KuzzleMock = require("../mocks/kuzzle.mock");
const FsMock = require("../mocks/fs.mock");

describe("Test: kuzzle/dumpGenerator", () => {
  let DumpGenerator;
  let dumpGenerator;
  let kuzzle;
  let fsStub;
  let coreStub;
  let suffix;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    fsStub = new FsMock();
    fsStub.readdirSync.returns(["core"]);
    fsStub.accessSync.throws("deactivated");
    fsStub.statSync.returns({
      isDirectory: () => true,
      birthtime: new Date("1979-12-28 14:56"),
    });

    coreStub = sinon.stub().returns({});

    kuzzle.config.dump = {
      history: {
        coredump: 3,
        reports: 5,
      },
      path: "/tmp",
      dateFormat: "YYYY",
    };
    kuzzle.pluginsManager.getPluginsDescription.returns({ foo: {} });
    kuzzle.pluginsManager.plugins = { foo: {} };
    kuzzle.statistics.getAllStats.resolves({ hits: [{ stats: 42 }] });

    mockrequire("fs", fsStub);
    mockrequire("dumpme", coreStub);

    mockrequire.reRequire("../../lib/kuzzle/dumpGenerator");
    DumpGenerator = rewire("../../lib/kuzzle/dumpGenerator");
    dumpGenerator = new DumpGenerator();

    kuzzle.config.dump.enabled = true;
    dumpGenerator._dump = false;
    suffix = "dump-me-master";
  });

  it("should reject with an error if a dump is in progress", async () => {
    dumpGenerator._dump = true;

    await should(dumpGenerator.dump(suffix)).rejectedWith(PreconditionError, {
      id: "api.process.action_locked",
    });
  });

  it("should generate dump files", async () => {
    const baseDumpPath = `/tmp/${new Date().getFullYear()}-${suffix}`;

    await dumpGenerator.dump(suffix);

    should(fsStub.mkdirSync).be.calledOnce();
    should(fsStub.mkdirSync.getCall(0).args[0]).be.exactly(baseDumpPath);

    should(fsStub.writeFileSync.getCall(0).args[0]).be.exactly(
      baseDumpPath.concat("/kuzzle.json"),
    );
    should(fsStub.writeFileSync.getCall(0).args[1]).be.exactly(
      JSON.stringify(
        {
          config: kuzzle.config,
          version: require("../../package.json").version,
        },
        null,
        " ",
      ).concat("\n"),
    );

    should(fsStub.writeFileSync.getCall(1).args[0]).be.exactly(
      baseDumpPath.concat("/plugins.json"),
    );
    should(fsStub.writeFileSync.getCall(1).args[1]).be.exactly(
      JSON.stringify(kuzzle.pluginsManager.plugins, null, " ").concat("\n"),
    );

    should(fsStub.writeFileSync.getCall(2).args[0]).be.exactly(
      baseDumpPath.concat("/nodejs.json"),
    );
    const processDump = JSON.parse(fsStub.writeFileSync.getCall(2).args[1]);
    should(processDump).have.keys(
      "env",
      "config",
      "argv",
      "versions",
      "release",
      "moduleLoadList",
    );

    should(fsStub.writeFileSync.getCall(3).args[0]).be.exactly(
      baseDumpPath.concat("/os.json"),
    );
    const osDump = JSON.parse(fsStub.writeFileSync.getCall(3).args[1]);
    should(osDump).have.keys(
      "platform",
      "loadavg",
      "uptime",
      "cpus",
      "mem",
      "networkInterfaces",
    );
    should(osDump.mem).have.keys("total", "free");

    should(fsStub.writeFileSync.getCall(4).args[0]).be.exactly(
      baseDumpPath.concat("/statistics.json"),
    );
    should(fsStub.writeFileSync.getCall(4).args[1]).be.exactly(
      JSON.stringify([{ stats: 42 }], null, " ").concat("\n"),
    );

    should(
      coreStub.firstCall.calledWith("gcore", baseDumpPath.concat("/core")),
    ).be.true();

    should(fsStub.createReadStream.getCall(0).args[0]).be.exactly(
      `/tmp/${new Date().getFullYear()}-dump-me-master/core`,
    );
    should(fsStub.createWriteStream).be.calledOnce();
    should(fsStub.createReadStream().pipe).be.called(2);

    should(fsStub.copyFileSync.getCall(0).args[0]).be.exactly(process.argv[0]);
    should(fsStub.copyFileSync.getCall(0).args[1]).be.exactly(
      baseDumpPath.concat("/node"),
    );
  });

  it("should do nothing if the dump path is not reachable", async () => {
    fsStub.accessSync.throws(new Error("foobar"));

    await dumpGenerator.dump(suffix);

    should(fsStub.removeSync).not.be.called();
  });

  it("should not delete reports nor coredumps if limits are not reached", async () => {
    fsStub.readdirSync.returns(["foo", "bar"]);

    await dumpGenerator.dump(suffix);

    should(fsStub.removeSync).not.be.called();
  });

  it("should delete reports directories if over the limit", async () => {
    fsStub.statSync.onSecondCall().returns({
      isDirectory: () => false,
      birthtime: new Date("1979-11-13 01:13"),
    });

    fsStub.readdirSync.returns([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);
    fsStub.accessSync.throws(new Error("no coredump here"));
    fsStub.accessSync.withArgs("/tmp", 0).returns();

    await dumpGenerator.dump(suffix);

    // readdir returns 9 directory + 1 non-directory
    // the limit is set to 5, so we should remove
    // (9 - 5 + 1) directories
    // (+1 because we are about to create a new one,
    // and we don't want the limit to be exceeded)
    should(fsStub.rmdirSync.callCount).be.eql(5);
  });

  it("should delete coredumps in reports directories, if over the limit", async () => {
    // do not let directory removals interfers with coredump removals
    sinon.stub(dumpGenerator, "_listFilesMatching");
    for (let i = 0; i < 10; i++) {
      dumpGenerator._listFilesMatching.onCall(i).returns([`/tmp/${i}/core.gz`]);
    }

    kuzzle.config.dump.history.reports = 100;
    fsStub.readdirSync.returns([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);

    fsStub.accessSync.throws(new Error("no coredump here"));
    fsStub.accessSync.withArgs("/tmp", 0).returns();

    await dumpGenerator.dump(suffix);

    for (let i = 1; i < 8; i++) {
      should(dumpGenerator._listFilesMatching).be.calledWith(
        `/tmp/${i}`,
        "core",
      );
      should(fsStub.unlinkSync).be.calledWith(`/tmp/${i}/core.gz`);
    }

    for (let i = 9; i < 11; i++) {
      should(dumpGenerator._listFilesMatching).not.be.calledWith(
        `/tmp/${i}/`,
        "core",
      );
    }
  });
});
