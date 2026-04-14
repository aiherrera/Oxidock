export type DockerCommandRisk = "safe" | "medium" | "destructive";

export type DockerCommandCategory = "containers" | "images" | "volumes" | "networks" | "events" | "general";

import { advancedDockerCommandRegistry, type AdvancedDockerCommandId } from "./docker-command-registry-advanced";

export type DockerCommandId =
  | AdvancedDockerCommandId
  | "containers.listRunning"
  | "containers.listAll"
  | "containers.run"
  | "containers.inspect"
  | "containers.logs"
  | "containers.stop"
  | "containers.start"
  | "containers.restart"
  | "containers.remove"
  | "containers.exec"
  | "containers.stats"
  | "containers.top"
  | "containers.pause"
  | "containers.unpause"
  | "containers.cp"
  | "images.list"
  | "images.pull"
  | "images.prune"
  | "images.build"
  | "images.tag"
  | "images.push"
  | "volumes.list"
  | "volumes.create"
  | "volumes.prune"
  | "networks.list"
  | "networks.create"
  | "networks.inspect"
  | "events.stream"
  | "system.prune"
  | "system.df"
  | "system.version"
  | "system.info"
  | "compose.up"
  | "compose.down"
  | "compose.ps"
  | "cli.run";

export type DockerCommandMetadata = {
  id: DockerCommandId;
  label: string;
  cli: string;
  /** Short line shown in suggestion list */
  explanation: string;
  /** Longer educative copy shown when a suggestion is focused */
  description: string;
  risk: DockerCommandRisk;
  category: DockerCommandCategory;
  aliases: string[];
  example: string;
  intents: string[];
  relatedIds?: DockerCommandId[];
  whenToUse?: string;
  prerequisites?: string[];
  /** Short “why this saves time” line for docs cards */
  proTip?: string;
  /** Shown in Docs as advanced / lifesaver playbook content */
  advanced?: boolean;
};

const coreDockerCommandRegistry = {
  "containers.listRunning": {
    id: "containers.listRunning",
    label: "List running containers",
    cli: "docker ps",
    explanation: "Shows containers that are currently running.",
    description:
      "Lists only running containers with ID, image, status, and published ports. Use this to see what is active on your machine right now.",
    risk: "safe",
    category: "containers",
    aliases: ["ps", "list containers"],
    example: "docker ps",
    intents: ["show running containers", "what is running", "list active containers"],
    relatedIds: ["containers.listAll", "containers.logs", "containers.inspect"],
    whenToUse: "Use when you only need currently running containers.",
    prerequisites: ["Docker Engine running"],
  },
  "containers.listAll": {
    id: "containers.listAll",
    label: "List all containers",
    cli: "docker ps -a",
    explanation: "Shows running and stopped containers.",
    description:
      "Includes stopped and exited containers. Helpful when you need to restart, remove, or inspect containers that are not currently running.",
    risk: "safe",
    category: "containers",
    aliases: ["ps -a", "ps --all"],
    example: "docker ps -a",
    intents: ["show all containers", "list stopped containers", "see exited containers"],
    relatedIds: ["containers.listRunning", "containers.start", "containers.remove"],
    whenToUse: "Use when you need stopped or exited containers too.",
    prerequisites: ["Docker Engine running"],
  },
  "containers.run": {
    id: "containers.run",
    label: "Run container",
    cli: "docker run <image>",
    explanation: "Creates and starts a new container from an image.",
    description:
      "Pulls the image if needed, creates a container, and starts it. Add flags like -d (detached), -p (port mapping), or --name to control behavior.",
    risk: "medium",
    category: "containers",
    aliases: ["run"],
    example: "docker run -d -p 8080:80 nginx:alpine",
    intents: ["start a new container", "run an image", "launch a service"],
    relatedIds: ["images.pull", "containers.logs", "containers.stop"],
    whenToUse: "Use to create and start a container from an image.",
    prerequisites: ["Image available locally or pullable"],
  },
  "containers.inspect": {
    id: "containers.inspect",
    label: "Inspect container",
    cli: "docker inspect <container>",
    explanation: "Returns detailed metadata for one container.",
    description:
      "Outputs JSON with configuration, mounts, networks, and state. Replace <container> with a name or short ID from docker ps.",
    risk: "safe",
    category: "containers",
    aliases: ["inspect"],
    example: "docker inspect my-app",
    intents: ["inspect container details", "container metadata", "debug container config"],
    relatedIds: ["containers.logs", "containers.listRunning"],
    whenToUse: "Use when you need full JSON configuration for one container.",
    prerequisites: ["Container name or ID"],
  },
  "containers.logs": {
    id: "containers.logs",
    label: "View logs",
    cli: "docker logs <container>",
    explanation: "Shows log output from one container.",
    description:
      "Reads stdout/stderr from the container process. Add --follow to stream live logs or --tail 100 to limit output.",
    risk: "safe",
    category: "containers",
    aliases: ["logs"],
    example: "docker logs --tail 50 my-app",
    intents: ["view container logs", "debug output", "see application logs"],
    relatedIds: ["containers.inspect", "containers.exec"],
    whenToUse: "Use to read stdout/stderr from a running or stopped container.",
    prerequisites: ["Container name or ID"],
  },
  "containers.stop": {
    id: "containers.stop",
    label: "Stop container",
    cli: "docker stop <container>",
    explanation: "Stops a running container gracefully.",
    description:
      "Sends SIGTERM, then SIGKILL if the process does not exit. The container remains on disk until you remove it.",
    risk: "medium",
    category: "containers",
    aliases: ["stop"],
    example: "docker stop my-app",
    intents: ["stop container", "shut down container"],
    relatedIds: ["containers.start", "containers.remove"],
    whenToUse: "Use to gracefully stop a running container.",
    prerequisites: ["Container name or ID"],
  },
  "containers.start": {
    id: "containers.start",
    label: "Start container",
    cli: "docker start <container>",
    explanation: "Starts a stopped container.",
    description:
      "Restarts an existing container with the same configuration. Use after docker stop or when a container exited.",
    risk: "medium",
    category: "containers",
    aliases: ["start"],
    example: "docker start my-app",
    intents: ["start stopped container", "resume container"],
    relatedIds: ["containers.stop", "containers.logs"],
    whenToUse: "Use to start an existing stopped container.",
    prerequisites: ["Container name or ID"],
  },
  "containers.restart": {
    id: "containers.restart",
    label: "Restart container",
    cli: "docker restart <container>",
    explanation: "Stops and starts a container.",
    description: "Equivalent to stop followed by start. Useful after config changes that require a process restart.",
    risk: "medium",
    category: "containers",
    aliases: ["restart"],
    example: "docker restart my-app",
    intents: ["restart container", "reload container process"],
    relatedIds: ["containers.stop", "containers.logs"],
    whenToUse: "Use when a container needs a fresh process without recreating it.",
    prerequisites: ["Container name or ID"],
  },
  "containers.remove": {
    id: "containers.remove",
    label: "Remove container",
    cli: "docker rm <container>",
    explanation: "Deletes a stopped container.",
    description:
      "Permanently removes the container filesystem layer. The container must be stopped unless you use -f to force removal.",
    risk: "destructive",
    category: "containers",
    aliases: ["rm container", "remove container"],
    example: "docker rm my-app",
    intents: ["delete container", "remove stopped container"],
    relatedIds: ["containers.listAll", "containers.stop"],
    whenToUse: "Use to permanently remove a container you no longer need.",
    prerequisites: ["Container stopped unless using -f"],
  },
  "containers.exec": {
    id: "containers.exec",
    label: "Exec into container",
    cli: "docker exec -it <container> sh",
    explanation: "Runs a command inside a running container.",
    description:
      "Opens an interactive shell or runs a one-off command in a running container. Replace sh with bash if available.",
    risk: "medium",
    category: "containers",
    aliases: ["exec"],
    example: "docker exec -it my-app sh",
    intents: ["shell into container", "run command inside container", "debug running container"],
    relatedIds: ["containers.logs", "containers.inspect"],
    whenToUse: "Use to interact with a running container's filesystem or processes.",
    prerequisites: ["Container must be running", "Container name or ID"],
  },
  "containers.stats": {
    id: "containers.stats",
    label: "Container stats",
    cli: "docker stats",
    explanation: "Shows live CPU, memory, and network usage for containers.",
    description:
      "Streams resource usage for running containers. Press Ctrl+C to stop. Add container names to limit output.",
    risk: "safe",
    category: "containers",
    aliases: ["stats"],
    example: "docker stats",
    intents: ["container resource usage", "cpu memory usage", "monitor containers"],
    relatedIds: ["containers.top", "containers.listRunning"],
    whenToUse: "Use to monitor live resource consumption.",
    prerequisites: ["Running containers"],
  },
  "containers.top": {
    id: "containers.top",
    label: "Container top",
    cli: "docker top <container>",
    explanation: "Shows running processes inside a container.",
    description:
      "Lists processes running inside the container, similar to the Unix top command scoped to one container.",
    risk: "safe",
    category: "containers",
    aliases: ["top"],
    example: "docker top my-app",
    intents: ["processes in container", "what is running inside container"],
    relatedIds: ["containers.exec", "containers.stats"],
    whenToUse: "Use to see which processes are active inside a container.",
    prerequisites: ["Container name or ID"],
  },
  "containers.pause": {
    id: "containers.pause",
    label: "Pause container",
    cli: "docker pause <container>",
    explanation: "Suspends all processes in a container.",
    description: "Freezes container processes without stopping the container. Use unpause to resume.",
    risk: "medium",
    category: "containers",
    aliases: ["pause"],
    example: "docker pause my-app",
    intents: ["pause container", "freeze container"],
    relatedIds: ["containers.unpause", "containers.stop"],
    whenToUse: "Use to temporarily suspend a container without tearing it down.",
    prerequisites: ["Container name or ID"],
  },
  "containers.unpause": {
    id: "containers.unpause",
    label: "Unpause container",
    cli: "docker unpause <container>",
    explanation: "Resumes a paused container.",
    description: "Restores process execution after docker pause.",
    risk: "medium",
    category: "containers",
    aliases: ["unpause"],
    example: "docker unpause my-app",
    intents: ["unpause container", "resume paused container"],
    relatedIds: ["containers.pause"],
    whenToUse: "Use after pausing a container to resume it.",
    prerequisites: ["Container name or ID"],
  },
  "containers.cp": {
    id: "containers.cp",
    label: "Copy files",
    cli: "docker cp <container>:/path ./local",
    explanation: "Copies files between container and host.",
    description:
      "Transfers files or directories between the container filesystem and your machine. Paths use container:path syntax.",
    risk: "medium",
    category: "containers",
    aliases: ["cp"],
    example: "docker cp my-app:/app/logs ./logs",
    intents: ["copy from container", "extract files from container"],
    relatedIds: ["containers.exec", "containers.inspect"],
    whenToUse: "Use to copy logs or config files out of a container.",
    prerequisites: ["Container name or ID", "Valid source and destination paths"],
  },
  "images.list": {
    id: "images.list",
    label: "List images",
    cli: "docker images",
    explanation: "Lists images in the local cache.",
    description: "Shows repository, tag, image ID, size, and creation time. Use docker image ls as an alias.",
    risk: "safe",
    category: "images",
    aliases: ["image ls", "images ls"],
    example: "docker images",
    intents: ["list images", "show local images", "what images do I have"],
    relatedIds: ["images.pull", "system.df"],
    whenToUse: "Use to see images cached on this machine.",
    prerequisites: ["Docker Engine running"],
  },
  "images.pull": {
    id: "images.pull",
    label: "Pull image",
    cli: "docker pull <image>",
    explanation: "Downloads an image from a registry.",
    description:
      "Fetches image layers from Docker Hub or another registry. Specify tag with image:tag, e.g. nginx:alpine.",
    risk: "safe",
    category: "images",
    aliases: ["pull"],
    example: "docker pull postgres:17-alpine",
    intents: ["download image", "pull image from registry"],
    relatedIds: ["images.list", "containers.run"],
    whenToUse: "Use before running an image that is not cached locally.",
    prerequisites: ["Network access to registry"],
  },
  "images.prune": {
    id: "images.prune",
    label: "Prune unused images",
    cli: "docker image prune",
    explanation: "Removes dangling images not used by any container.",
    description:
      "Frees disk space from unused image layers. Add -a to remove all images not referenced by a container, or use with care.",
    risk: "destructive",
    category: "images",
    aliases: ["image prune"],
    example: "docker image prune -f",
    intents: ["free disk space images", "clean unused images"],
    relatedIds: ["system.df", "system.prune"],
    whenToUse: "Use to reclaim space from dangling image layers.",
    prerequisites: ["Understand which images may be removed"],
  },
  "images.build": {
    id: "images.build",
    label: "Build image",
    cli: "docker build -t my-app .",
    explanation: "Builds an image from a Dockerfile in the current directory.",
    description:
      "Runs the build context through Docker and produces a tagged image. Use -f to specify a different Dockerfile path.",
    risk: "medium",
    category: "images",
    aliases: ["build"],
    example: "docker build -t my-app:latest .",
    intents: ["build docker image", "create image from dockerfile"],
    relatedIds: ["images.tag", "containers.run"],
    whenToUse: "Use when you have a Dockerfile and want to create an image.",
    prerequisites: ["Dockerfile in build context"],
  },
  "images.tag": {
    id: "images.tag",
    label: "Tag image",
    cli: "docker tag my-app:latest my-app:v1",
    explanation: "Assigns a new tag to an existing image.",
    description: "Creates an additional name/tag pointing at the same image ID. Useful before pushing to a registry.",
    risk: "safe",
    category: "images",
    aliases: ["tag"],
    example: "docker tag my-app:latest registry.example.com/my-app:v1",
    intents: ["tag image", "rename image tag"],
    relatedIds: ["images.push", "images.build"],
    whenToUse: "Use to prepare an image name for a registry push.",
    prerequisites: ["Source image ID or name:tag"],
  },
  "images.push": {
    id: "images.push",
    label: "Push image",
    cli: "docker push my-app:latest",
    explanation: "Uploads an image to a registry.",
    description: "Pushes tagged layers to Docker Hub or another registry. You must be logged in with docker login.",
    risk: "medium",
    category: "images",
    aliases: ["push"],
    example: "docker push my-app:latest",
    intents: ["push image to registry", "publish docker image"],
    relatedIds: ["images.tag", "images.pull"],
    whenToUse: "Use after tagging to publish an image to a registry.",
    prerequisites: ["Registry credentials", "Tagged image"],
  },
  "volumes.list": {
    id: "volumes.list",
    label: "List volumes",
    cli: "docker volume ls",
    explanation: "Lists named volumes managed by Docker.",
    description: "Shows volume name, driver, and mountpoint. Volumes persist data beyond container lifecycle.",
    risk: "safe",
    category: "volumes",
    aliases: ["volume ls"],
    example: "docker volume ls",
    intents: ["list volumes", "show persistent storage"],
    relatedIds: ["volumes.create", "volumes.prune"],
    whenToUse: "Use to inspect named volumes on this host.",
    prerequisites: ["Docker Engine running"],
  },
  "volumes.create": {
    id: "volumes.create",
    label: "Create volume",
    cli: "docker volume create my-data",
    explanation: "Creates a named volume for persistent data.",
    description:
      "Provisions a new volume that containers can mount. Data persists independently of container lifecycle.",
    risk: "medium",
    category: "volumes",
    aliases: ["volume create"],
    example: "docker volume create my-data",
    intents: ["create volume", "persistent storage volume"],
    relatedIds: ["volumes.list", "containers.run"],
    whenToUse: "Use when a container needs durable storage beyond its filesystem.",
    prerequisites: ["Volume name"],
  },
  "volumes.prune": {
    id: "volumes.prune",
    label: "Prune unused volumes",
    cli: "docker volume prune",
    explanation: "Removes volumes not used by any container.",
    description: "Deletes anonymous and unused named volumes. Data in removed volumes cannot be recovered.",
    risk: "destructive",
    category: "volumes",
    aliases: ["volume prune"],
    example: "docker volume prune -f",
    intents: ["delete unused volumes", "clean volume data"],
    relatedIds: ["volumes.list", "system.df"],
    whenToUse: "Use to remove volumes not referenced by any container.",
    prerequisites: ["Confirm no needed data in unused volumes"],
  },
  "networks.list": {
    id: "networks.list",
    label: "List networks",
    cli: "docker network ls",
    explanation: "Lists Docker networks on this host.",
    description:
      "Shows bridge, host, and custom networks. Containers attach to networks for inter-container communication.",
    risk: "safe",
    category: "networks",
    aliases: ["network ls"],
    example: "docker network ls",
    intents: ["list networks", "show docker networks"],
    relatedIds: ["networks.create", "networks.inspect"],
    whenToUse: "Use to see bridge and custom networks.",
    prerequisites: ["Docker Engine running"],
  },
  "networks.create": {
    id: "networks.create",
    label: "Create network",
    cli: "docker network create my-net",
    explanation: "Creates a custom bridge network.",
    description: "Containers on the same custom network can reach each other by name. Default driver is bridge.",
    risk: "medium",
    category: "networks",
    aliases: ["network create"],
    example: "docker network create my-net",
    intents: ["create docker network", "custom network for containers"],
    relatedIds: ["networks.list", "containers.run"],
    whenToUse: "Use when services need isolated communication on a custom network.",
    prerequisites: ["Network name"],
  },
  "networks.inspect": {
    id: "networks.inspect",
    label: "Inspect network",
    cli: "docker network inspect <network>",
    explanation: "Shows configuration and connected containers for a network.",
    description: "Outputs JSON with subnet, gateway, and container endpoints. Useful for debugging connectivity.",
    risk: "safe",
    category: "networks",
    aliases: ["network inspect"],
    example: "docker network inspect bridge",
    intents: ["inspect network", "debug network connectivity"],
    relatedIds: ["networks.list", "containers.inspect"],
    whenToUse: "Use to see subnets and attached containers for one network.",
    prerequisites: ["Network name or ID"],
  },
  "events.stream": {
    id: "events.stream",
    label: "Stream events",
    cli: "docker events",
    explanation: "Streams real-time events from the Docker daemon.",
    description: "Prints create, start, stop, die, and other lifecycle events. Press Ctrl+C to stop streaming.",
    risk: "safe",
    category: "events",
    aliases: ["events"],
    example: "docker events --since 1h",
    intents: ["watch docker events", "stream container lifecycle"],
    relatedIds: ["containers.listRunning"],
    whenToUse: "Use to observe create/start/stop events in real time.",
    prerequisites: ["Docker Engine running"],
  },
  "system.prune": {
    id: "system.prune",
    label: "System prune",
    cli: "docker system prune",
    explanation: "Removes unused containers, networks, and dangling images.",
    description:
      "Cleans up stopped containers, unused networks, and build cache. Add --volumes to include unused volumes. This can free significant disk space.",
    risk: "destructive",
    category: "general",
    aliases: ["system prune", "prune"],
    example: "docker system prune -f",
    intents: ["free disk space", "clean docker system", "remove unused data"],
    relatedIds: ["system.df", "images.prune", "volumes.prune"],
    whenToUse: "Use when Docker is using too much disk and you want a broad cleanup.",
    prerequisites: ["Review what will be removed before confirming"],
  },
  "system.df": {
    id: "system.df",
    label: "Disk usage",
    cli: "docker system df",
    explanation: "Shows disk usage by images, containers, and volumes.",
    description: "Summarizes how much space Docker objects consume before running prune commands.",
    risk: "safe",
    category: "general",
    aliases: ["system df", "df"],
    example: "docker system df",
    intents: ["docker disk usage", "how much space docker uses"],
    relatedIds: ["system.prune", "images.list"],
    whenToUse: "Use before prune commands to understand space usage.",
    prerequisites: ["Docker Engine running"],
  },
  "system.version": {
    id: "system.version",
    label: "Docker version",
    cli: "docker version",
    explanation: "Shows client and server Docker version information.",
    description: "Displays API version, Go version, and build details for both Docker CLI and Engine.",
    risk: "safe",
    category: "general",
    aliases: ["version"],
    example: "docker version",
    intents: ["docker version", "check docker installed", "what version of docker"],
    relatedIds: ["system.info"],
    whenToUse: "Use to verify Docker CLI and Engine versions.",
    prerequisites: ["Docker CLI installed"],
  },
  "system.info": {
    id: "system.info",
    label: "Docker info",
    cli: "docker info",
    explanation: "Shows system-wide Docker configuration and resource summary.",
    description:
      "Reports storage driver, runtime, container counts, and daemon configuration. Helpful for troubleshooting setup.",
    risk: "safe",
    category: "general",
    aliases: ["info"],
    example: "docker info",
    intents: ["docker system info", "docker daemon status", "docker configuration"],
    relatedIds: ["system.version", "system.df"],
    whenToUse: "Use to inspect overall Docker Engine state and limits.",
    prerequisites: ["Docker Engine running"],
  },
  "compose.up": {
    id: "compose.up",
    label: "Compose up",
    cli: "docker compose up",
    explanation: "Starts services defined in docker-compose.yml.",
    description:
      "Builds images if needed and creates containers for each service. Use -d for detached mode in the background.",
    risk: "medium",
    category: "general",
    aliases: ["compose up"],
    example: "docker compose up -d",
    intents: ["start compose stack", "run docker compose"],
    relatedIds: ["compose.ps", "compose.down"],
    whenToUse: "Use in a directory with docker-compose.yml to start services.",
    prerequisites: ["docker-compose.yml in current directory"],
  },
  "compose.down": {
    id: "compose.down",
    label: "Compose down",
    cli: "docker compose down",
    explanation: "Stops and removes compose project containers.",
    description:
      "Tears down containers and default networks created by compose up. Add -v to remove named volumes declared in the file.",
    risk: "destructive",
    category: "general",
    aliases: ["compose down"],
    example: "docker compose down",
    intents: ["stop compose stack", "tear down compose project"],
    relatedIds: ["compose.up", "compose.ps"],
    whenToUse: "Use to stop and remove compose project containers.",
    prerequisites: ["Compose project was started from this directory"],
  },
  "compose.ps": {
    id: "compose.ps",
    label: "Compose ps",
    cli: "docker compose ps",
    explanation: "Lists containers for the current compose project.",
    description: "Similar to docker ps but scoped to the compose file in the current directory.",
    risk: "safe",
    category: "general",
    aliases: ["compose ps"],
    example: "docker compose ps",
    intents: ["list compose containers", "compose status"],
    relatedIds: ["compose.up", "containers.listRunning"],
    whenToUse: "Use to list containers for the current compose project.",
    prerequisites: ["Compose project in current directory"],
  },
  "cli.run": {
    id: "cli.run",
    label: "Run docker command",
    cli: "docker <command>",
    explanation: "Executes an arbitrary docker subcommand.",
    description: "Passes arguments directly to the docker CLI. Use when no preset matches your task.",
    risk: "medium",
    category: "general",
    aliases: ["docker"],
    example: "docker version",
    intents: ["run docker command", "custom docker command"],
    whenToUse: "Use when no curated command matches your exact need.",
    prerequisites: ["Valid docker subcommand"],
  },
} as const satisfies Record<Exclude<DockerCommandId, AdvancedDockerCommandId>, DockerCommandMetadata>;

export const dockerCommandRegistry = {
  ...coreDockerCommandRegistry,
  ...advancedDockerCommandRegistry,
} as const satisfies Record<DockerCommandId, DockerCommandMetadata>;

export const dockerCommandList: DockerCommandMetadata[] = Object.values(dockerCommandRegistry);

export const getDockerCommand = (id: DockerCommandId, values?: { container?: string }): DockerCommandMetadata => {
  const command = dockerCommandRegistry[id];
  const cli = values?.container ? command.cli.replace("<container>", values.container) : command.cli;

  return {
    ...command,
    cli,
    example: values?.container ? command.example.replace("<container>", values.container) : command.example,
  };
};

export const riskLabels: Record<DockerCommandRisk, string> = {
  safe: "Safe",
  medium: "Caution",
  destructive: "Destructive",
};
