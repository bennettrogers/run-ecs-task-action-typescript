import * as core from "@actions/core";
import {
  DescribeServicesCommand,
  DescribeTasksCommand,
  ECSClient,
  RunTaskCommand,
  waitUntilTasksRunning,
  waitUntilTasksStopped,
} from "@aws-sdk/client-ecs";

type Inputs = {
  ecsService: string;
  ecsCluster: string;
  ecsTaskDefinition: string;
  ecsContainerName: string;
  command: string;
};

const client = new ECSClient({ region: "us-east-1" });

// eslint-disable-next-line @typescript-eslint/require-await
export const run = async (inputs: Inputs): Promise<void> => {
  core.info(`Running command "${inputs.command}" on ECS service: ${inputs.ecsService}`);
  const command = new DescribeServicesCommand({
    cluster: inputs.ecsCluster,
    services: [inputs.ecsService],
  });

  const response = await client.send(command);

  if (!(response.services && response.services.length > 0)) {
    throw new Error("No services found in the cluster.");
  }

  const service = response.services[0];
  const networkConfiguration = service.networkConfiguration;

  if (!(networkConfiguration && networkConfiguration.awsvpcConfiguration)) {
    throw new Error("No awsvpcConfiguration found for the service.");
  }

  const subnets = networkConfiguration.awsvpcConfiguration.subnets;
  const securityGroups = networkConfiguration.awsvpcConfiguration.securityGroups;

  const runTaskCommand = new RunTaskCommand({
    cluster: inputs.ecsCluster,
    taskDefinition: inputs.ecsTaskDefinition,
    launchType: "FARGATE",
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets,
        securityGroups,
        assignPublicIp: "ENABLED",
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: inputs.ecsContainerName,
          command: inputs.command.split(" "),
        },
      ],
    },
  });

  const runTaskResponse = await client.send(runTaskCommand);

  if (!(runTaskResponse.tasks && runTaskResponse.tasks.length > 0)) {
    throw new Error("No tasks found in the response.");
  }

  const taskArn = runTaskResponse.tasks[0].taskArn;

  if (!taskArn) {
    throw new Error("No taskArn found in the response.");
  }

  core.info(`Task started successfully. Task ARN: ${taskArn}`);

  await waitUntilTasksRunning({ client, maxWaitTime: 120 }, { cluster: inputs.ecsCluster, tasks: [taskArn] });

  core.info("Task is running. Waiting for it to stop...");

  await waitUntilTasksStopped({ client, maxWaitTime: 120 }, { cluster: inputs.ecsCluster, tasks: [taskArn] });

  core.info("Task stopped successfully.");

  const describeTasksCommand = new DescribeTasksCommand({
    cluster: inputs.ecsCluster,
    tasks: [taskArn],
  });

  const describeTasksResponse = await client.send(describeTasksCommand);

  if (!(describeTasksResponse.tasks && describeTasksResponse.tasks.length > 0)) {
    throw new Error("No tasks found in the response.");
  }

  const task = describeTasksResponse.tasks[0];
  if (!task.taskArn) {
    throw new Error("No taskArn found in the response.");
  }
  const containerName = task.containers && task.containers[0].name;

  if (!containerName) {
    throw new Error("No containerName found in the response.");
  }

  const exitCode = task.containers && task.containers[0].exitCode;

  if (exitCode !== 0) {
    throw new Error(`Command failed with exit code: ${exitCode}`);
  }

  core.info(`Command "${inputs.command}" ran successfully in container "${containerName}"`);

  // Return the task ARN
  core.setOutput("taskArn", taskArn);
};
