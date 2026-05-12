import { spawn, spawnSync } from "node:child_process";

const containerName = process.env.TAP_CONTAINER_NAME ?? "lexshift-tap";
const tapImage = process.env.TAP_IMAGE ?? "ghcr.io/bluesky-social/indigo/tap:latest";
const hostPort = process.env.TAP_PORT ?? "2480";
const rawTapArgs = process.env.TAP_ARGS
  ? process.env.TAP_ARGS.split(" ").filter((arg) => arg.length > 0)
  : [];
const tapArgs = normalizeTapArgs(rawTapArgs);

function normalizeTapArgs(args: string[]): string[] {
  if (args.length === 0) {
    return ["/tap", "run", "--disable-acks=true", "--no-replay=true"];
  }

  const [first, ...rest] = args;
  if (!first) {
    return ["/tap", "run", "--disable-acks=true", "--no-replay=true"];
  }

  if (first === "tap") {
    return ["/tap", ...rest];
  }

  if (first === "run") {
    return ["/tap", ...args];
  }

  if (first.startsWith("-")) {
    return ["/tap", "run", ...args];
  }

  return args;
}

function ensureDockerIsAvailable() {
  const result = spawnSync("docker", ["--version"], { stdio: "ignore" });
  if (result.status !== 0) {
    throw new Error(
      "Docker is required to run the Tap app. Install Docker or set TAP_IMAGE/TAP_ARGS to a working setup.",
    );
  }
}

function removeExistingContainer() {
  const inspect = spawnSync(
    "docker",
    ["ps", "-aq", "--filter", `name=^/${containerName}$`],
    { encoding: "utf8" },
  );

  if (inspect.status !== 0) {
    throw new Error(`Unable to inspect existing container ${containerName}`);
  }

  const containerId = inspect.stdout.trim();
  if (containerId.length === 0) {
    return;
  }

  const remove = spawnSync("docker", ["rm", "-f", containerName], {
    stdio: "inherit",
  });
  if (remove.status !== 0) {
    throw new Error(`Unable to remove existing container ${containerName}`);
  }
}

function run() {
  ensureDockerIsAvailable();
  removeExistingContainer();

  const child = spawn(
    "docker",
    [
      "run",
      "--rm",
      "--name",
      containerName,
      "-p",
      `${hostPort}:2480`,
      tapImage,
      ...tapArgs,
    ],
    { stdio: "inherit" },
  );

  const stop = () => {
    const stopper = spawnSync("docker", ["stop", containerName], {
      stdio: "inherit",
    });
    process.exit(stopper.status ?? 0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

run();
