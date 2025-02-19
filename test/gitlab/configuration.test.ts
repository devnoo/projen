import * as YAML from "yaml";
import { CiConfiguration } from "../../src/gitlab";
import { synthSnapshot, TestProject } from "../util";

test("throws when adding an existing service with same name and alias", () => {
  // GIVEN
  const p = new TestProject({
    stale: true,
  });
  const c = new CiConfiguration(p, "foo");
  c.addServices({ name: "bar" });
  // THEN
  expect(() => c.addServices({ name: "bar" })).toThrowError(
    /GitLab CI already contains/
  );
  expect(() =>
    c.addServices({ name: "foobar" }, { name: "foobar" })
  ).toThrowError(/GitLab CI already contains/);
});

test("does not throw when adding an services with same name and different alias", () => {
  // GIVEN
  const p = new TestProject({
    stale: true,
  });
  const c = new CiConfiguration(p, "foo");
  c.addServices({ name: "foo", alias: "foobar" });
  // THEN
  expect(() => c.addServices({ name: "foo", alias: "baz" })).not.toThrowError(
    /GitLab CI already contains/
  );
});

test("does not throw when adding an valid include", () => {
  // GIVEN
  const p = new TestProject({
    stale: true,
  });
  const c = new CiConfiguration(p, "foo");
  // THEN
  expect(() => c.addIncludes({ local: "foo" })).not.toThrowError(
    /A valid include configuration specifies/
  );
  expect(() =>
    c.addIncludes({ file: ["foo"], project: "foo" })
  ).not.toThrowError(/A valid include configuration specifies/);
  expect(() => c.addIncludes({ remote: "foo" })).not.toThrowError(
    /A valid include configuration specifies/
  );
  expect(() => c.addIncludes({ template: "foo" })).not.toThrowError(
    /A valid include configuration specifies/
  );
});

test("throws when adding an invalid include", () => {
  // GIVEN
  const p = new TestProject({
    stale: true,
  });
  const c = new CiConfiguration(p, "foo");
  // THEN
  expect(() =>
    c.addIncludes({ file: ["foo"], project: "foo", local: "foo" })
  ).toThrow(/contains 2 property combination/);
  expect(() => c.addIncludes({ project: "foo" })).toThrow(
    /contains 0 property combination/
  );
});

test("throws when adding an existing includes", () => {
  // GIVEN
  const p = new TestProject({
    stale: true,
  });
  const c = new CiConfiguration(p, "foo");
  c.addIncludes(
    { local: "foo" },
    { file: ["foo"], project: "foo" },
    { remote: "foo" },
    { template: "foo" }
  );
  // THEN
  expect(() => c.addIncludes({ local: "foo" })).toThrowError(
    /already contains one or more templates specified in/
  );
  expect(() => c.addIncludes({ file: ["foo"], project: "foo" })).toThrowError(
    /already contains one or more templates specified in/
  );
  expect(() => c.addIncludes({ remote: "foo" })).toThrowError(
    /already contains one or more templates specified in/
  );
  expect(() => c.addIncludes({ template: "foo" })).toThrowError(
    /already contains one or more templates specified in/
  );
});

test("respected the original format when variables are added to jobs", () => {
  // GIVEN
  const p = new TestProject({
    stale: true,
  });
  new CiConfiguration(p, "foo", {
    jobs: {
      build: {
        variables: { AWS_REGION: "eu-central-1" },
      },
    },
  });
  // THEN
  expect(
    YAML.parse(synthSnapshot(p)[".gitlab/ci-templates/foo.yml"]).build.variables
  ).toStrictEqual({ AWS_REGION: "eu-central-1" });
});

test("respect the original format when adding global variables", () => {
  // GIVEN
  const p = new TestProject({
    stale: true,
  });
  const c = new CiConfiguration(p, "foo", {
    variables: { AWS_DEFAULT_OUTPUT: "json" },
  });
  c.addGlobalVariables({
    AWS_REGION: "eu-central-1",
  });
  // THEN
  expect(
    YAML.parse(synthSnapshot(p)[".gitlab/ci-templates/foo.yml"]).variables
  ).toStrictEqual({
    AWS_DEFAULT_OUTPUT: "json",
    AWS_REGION: "eu-central-1",
  });
});

test("adds correct entries for path-based caching", () => {
  // GIVEN
  const p = new TestProject({
    stale: true,
  });
  new CiConfiguration(p, "foo", {
    default: {
      cache: {
        paths: ["node_modules"],
        key: "${CI_COMMIT_REF_SLUG}",
      },
    },
  });
  const snapshot = synthSnapshot(p);
  // THEN
  expect(snapshot[".gitlab/ci-templates/foo.yml"]).toMatchSnapshot();
});

test("adds correct entries for file-based caching", () => {
  // GIVEN
  const p = new TestProject({
    stale: true,
  });
  new CiConfiguration(p, "foo", {
    default: {
      cache: {
        key: {
          files: ["Gemfile.lock", "package.json"],
          prefix: "${CI_COMMIT_REF_SLUG}",
        },
      },
    },
  });
  const snapshot = synthSnapshot(p);
  // THEN
  expect(snapshot[".gitlab/ci-templates/foo.yml"]).toMatchSnapshot();
});

test("does not snake job names", () => {
  // GIVEN
  const p = new TestProject({
    stale: true,
  });
  new CiConfiguration(p, "job-names", {
    jobs: {
      ".my-cache": {
        script: ["echo Here goes .my-cache"],
      },
      ".my_cache": {
        script: ["echo Here goes .my_cache"],
      },
      "my-job": {
        extends: [".my-cache"],
        script: ["echo Here is my-job"],
      },
      my_job: {
        extends: [".my_cache"],
        script: ["echo Here is my_job"],
      },
    },
  });
  const snapshot = synthSnapshot(p);
  // THEN
  expect(snapshot[".gitlab/ci-templates/job-names.yml"]).toStrictEqual(
    `# ~~ Generated by projen. To modify, edit .projenrc.js and run "npx projen".

.my-cache:
  script:
    - echo Here goes .my-cache
.my_cache:
  script:
    - echo Here goes .my_cache
my-job:
  extends:
    - .my-cache
  script:
    - echo Here is my-job
my_job:
  extends:
    - .my_cache
  script:
    - echo Here is my_job
`
  );
});

test("test code coverage report", () => {
  // GIVEN
  const p = new TestProject({
    stale: true,
  });
  new CiConfiguration(p, "foo", {
    jobs: {
      build: {
        artifacts: {
          reports: {
            coverageReport: {
              coverageFormat: "cobertura",
              path: "coverage/cobertura-coverage.xml",
            },
          },
        },
      },
    },
  });
  // THEN
  expect(
    YAML.parse(synthSnapshot(p)[".gitlab/ci-templates/foo.yml"]).build.artifacts
      .reports
  ).toStrictEqual({
    coverage_report: {
      coverage_format: "cobertura",
      path: "coverage/cobertura-coverage.xml",
    },
  });
});
