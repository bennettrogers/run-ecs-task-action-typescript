import { run } from "../src/run.js";

const ecsCluster = "";
const ecsService = "";
const ecsTaskDefinition = "";
const ecsContainerName = "";
const command = "";

test("run successfully", async () => {
  await expect(run({ ecsCluster, ecsService, ecsTaskDefinition, ecsContainerName, command })).resolves.toBeUndefined();
}, 120000);
