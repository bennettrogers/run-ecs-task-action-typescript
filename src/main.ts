import * as core from "@actions/core";

import { run } from "./run.js";

const main = async (): Promise<void> => {
  await run({
    ecsService: core.getInput("ecsService", { required: true }),
    ecsCluster: core.getInput("ecsCluster", { required: true }),
    ecsTaskDefinition: core.getInput("ecsTaskDefinition", { required: true }),
    ecsContainerName: core.getInput("ecsContainerName", { required: true }),
    command: core.getInput("command", { required: true }),
  });
};

main().catch((e: Error) => {
  core.setFailed(e);
  console.error(e);
});
