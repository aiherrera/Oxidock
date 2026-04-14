import type { DockerCommandId } from "./docker-command-registry";

export type DockerCommandLessonId =
  | "first-steps"
  | "container-basics"
  | "debugging"
  | "container-lifecycle"
  | "images"
  | "storage"
  | "networks-events"
  | "compose"
  | "cleanup"
  | "custom-cli"
  | "advanced-debugging"
  | "image-forensics"
  | "compose-triage"
  | "network-lifesavers"
  | "volume-rescue"
  | "safe-cleanup-advanced";

export type DockerCommandLessonTier = "core" | "advanced";

export type DockerCommandLesson = {
  id: DockerCommandLessonId;
  title: string;
  subtitle: string;
  goal: string;
  tier: DockerCommandLessonTier;
  commandIds: DockerCommandId[];
};

export const dockerCommandLessons: DockerCommandLesson[] = [
  {
    id: "first-steps",
    title: "First steps",
    subtitle: "See what Docker is doing before changing anything.",
    goal: "Build confidence with read-only commands before touching containers.",
    tier: "core",
    commandIds: ["system.version", "system.info", "system.df", "containers.listRunning", "containers.listAll"],
  },
  {
    id: "container-basics",
    title: "Container basics",
    subtitle: "Create containers and learn how to find them again.",
    goal: "Understand the difference between running, stopped, and newly created containers.",
    tier: "core",
    commandIds: ["containers.run", "containers.listRunning", "containers.listAll", "containers.inspect"],
  },
  {
    id: "debugging",
    title: "Debugging containers",
    subtitle: "Read logs, inspect processes, and step inside a running container.",
    goal: "Learn the safe commands you reach for when an app is misbehaving.",
    tier: "core",
    commandIds: [
      "containers.logs",
      "containers.exec",
      "containers.stats",
      "containers.top",
      "containers.cp",
      "events.stream",
    ],
  },
  {
    id: "container-lifecycle",
    title: "Container lifecycle",
    subtitle: "Stop, start, pause, resume, restart, and remove containers.",
    goal: "Control containers deliberately and know which actions can remove data.",
    tier: "core",
    commandIds: [
      "containers.stop",
      "containers.start",
      "containers.restart",
      "containers.pause",
      "containers.unpause",
      "containers.remove",
    ],
  },
  {
    id: "images",
    title: "Images",
    subtitle: "Download, build, tag, publish, and clean up images.",
    goal: "Learn the image workflow from local cache to registry.",
    tier: "core",
    commandIds: ["images.list", "images.pull", "images.build", "images.tag", "images.push", "images.prune"],
  },
  {
    id: "storage",
    title: "Volumes and storage",
    subtitle: "Work with persistent data without accidentally deleting it.",
    goal: "Understand what survives container removal and what prune commands can erase.",
    tier: "core",
    commandIds: ["volumes.list", "volumes.create", "volumes.prune"],
  },
  {
    id: "networks-events",
    title: "Networks and events",
    subtitle: "Connect services and watch Docker activity in real time.",
    goal: "Debug connectivity and observe lifecycle changes without changing app code.",
    tier: "core",
    commandIds: ["networks.list", "networks.create", "networks.inspect", "events.stream"],
  },
  {
    id: "compose",
    title: "Compose basics",
    subtitle: "Run, inspect, and stop multi-container projects.",
    goal: "Use Docker Compose for project-level workflows instead of managing every container by hand.",
    tier: "core",
    commandIds: ["compose.up", "compose.ps", "compose.down"],
  },
  {
    id: "cleanup",
    title: "Cleanup and disk space",
    subtitle: "Check usage first, then remove only what you mean to remove.",
    goal: "Make cleanup decisions with safety context instead of guessing.",
    tier: "core",
    commandIds: ["system.df", "images.prune", "volumes.prune", "system.prune"],
  },
  {
    id: "custom-cli",
    title: "Custom CLI commands",
    subtitle: "Know when to leave the curated guide and run a specific Docker subcommand.",
    goal: "Use the playground safely when your exact command is not listed here.",
    tier: "core",
    commandIds: ["cli.run"],
  },
  {
    id: "advanced-debugging",
    title: "Debugging",
    subtitle: "Lifesaver commands when logs and ps are not enough.",
    goal: "Triage crashes, ports, resource spikes, and network namespaces like an on-call engineer.",
    tier: "advanced",
    commandIds: [
      "containers.logsSinceFollow",
      "containers.execAsRoot",
      "containers.inspectState",
      "containers.inspectIp",
      "containers.port",
      "containers.statsNoStream",
      "containers.topAux",
      "containers.runNetshootSidecar",
    ],
  },
  {
    id: "image-forensics",
    title: "Image forensics",
    subtitle: "Investigate layers, rebuild cleanly, and scan before deploy.",
    goal: "Understand what is inside an image and rebuild without stale cache surprises.",
    tier: "advanced",
    commandIds: [
      "images.historyNoTrunc",
      "images.inspectDetail",
      "images.buildNoCachePlain",
      "images.buildTarget",
      "images.scoutCves",
      "containers.runEntrypointShell",
    ],
  },
  {
    id: "compose-triage",
    title: "Compose triage",
    subtitle: "Debug multi-service stacks without guessing container names.",
    goal: "Validate compose files, tail one service, and recreate only what changed.",
    tier: "advanced",
    commandIds: [
      "compose.config",
      "compose.psAll",
      "compose.logsFollow",
      "compose.exec",
      "compose.buildNoCache",
      "compose.upForceRecreate",
    ],
  },
  {
    id: "network-lifesavers",
    title: "Network lifesavers",
    subtitle: "Prove DNS and HTTP work container-to-container.",
    goal: "Separate network misconfig from application bugs using netshoot and inspect.",
    tier: "advanced",
    commandIds: ["networks.inspectFormatContainers", "networks.runDig", "networks.runCurlHealth"],
  },
  {
    id: "volume-rescue",
    title: "Volume rescue",
    subtitle: "Measure, inspect, and back up data before you delete anything.",
    goal: "Handle disk pressure and migrations without losing named volume data.",
    tier: "advanced",
    commandIds: ["volumes.inspectDetail", "volumes.runDu", "volumes.runBackup", "system.dfVerbose", "builder.prune"],
  },
  {
    id: "safe-cleanup-advanced",
    title: "Safe cleanup",
    subtitle: "Prune with filters and clean compose orphans.",
    goal: "Reclaim disk space without the collateral damage of blanket prune commands.",
    tier: "advanced",
    commandIds: [
      "containers.psExited",
      "containers.psUnhealthy",
      "containers.psFormat",
      "containers.updateRestart",
      "containers.pruneUntil",
      "images.pruneUntil",
      "builder.pruneUntil",
      "compose.downOrphans",
    ],
  },
];

export const getLessonById = (id: DockerCommandLessonId) => dockerCommandLessons.find((lesson) => lesson.id === id);

export const isAdvancedLesson = (lesson: DockerCommandLesson) => lesson.tier === "advanced";
