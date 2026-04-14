import type { DockerCommandCategory } from "./docker-command-registry";
import type { DockerCommandId } from "./docker-command-registry";
import type { DockerCommandLessonId } from "./docker-command-lessons";

export type DockerDocsLink = {
  id: string;
  title: string;
  description: string;
  url: string;
  keywords: string[];
  commandIds?: DockerCommandId[];
  lessonIds?: DockerCommandLessonId[];
  categories?: DockerCommandCategory[];
};

export const dockerDocsLinks: DockerDocsLink[] = [
  {
    id: "docs-get-started",
    title: "Get started with Docker",
    description: "Overview of containers, images, and the Docker workflow.",
    url: "https://docs.docker.com/get-started/",
    keywords: ["beginner", "start", "introduction", "overview", "basics"],
    lessonIds: ["first-steps"],
  },
  {
    id: "docs-containers",
    title: "Run containers",
    description: "Create, run, and manage containers on your machine.",
    url: "https://docs.docker.com/engine/containers/run/",
    keywords: ["run", "container", "start", "create", "exec"],
    categories: ["containers"],
    lessonIds: ["container-basics", "container-lifecycle"],
  },
  {
    id: "docs-logs",
    title: "View container logs",
    description: "Read stdout and stderr from running or stopped containers.",
    url: "https://docs.docker.com/engine/logging/",
    keywords: ["logs", "debug", "stdout", "stderr", "tail"],
    commandIds: ["containers.logs"],
    lessonIds: ["debugging"],
  },
  {
    id: "docs-images",
    title: "Work with images",
    description: "Pull, tag, build, and push container images.",
    url: "https://docs.docker.com/engine/reference/commandline/image/",
    keywords: ["image", "pull", "tag", "build", "push", "registry"],
    categories: ["images"],
    lessonIds: ["images"],
  },
  {
    id: "docs-volumes",
    title: "Manage volumes",
    description: "Persist data with Docker volumes and bind mounts.",
    url: "https://docs.docker.com/storage/volumes/",
    keywords: ["volume", "storage", "persist", "mount", "data"],
    categories: ["volumes"],
    lessonIds: ["storage", "volume-rescue"],
  },
  {
    id: "docs-networks",
    title: "Networking overview",
    description: "Connect containers with bridge, overlay, and custom networks.",
    url: "https://docs.docker.com/engine/network/",
    keywords: ["network", "bridge", "connect", "port", "dns"],
    categories: ["networks"],
    lessonIds: ["networks-events", "network-lifesavers"],
  },
  {
    id: "docs-compose",
    title: "Docker Compose",
    description: "Define and run multi-container applications with Compose.",
    url: "https://docs.docker.com/compose/",
    keywords: ["compose", "stack", "project", "multi-container", "yaml"],
    lessonIds: ["compose", "compose-triage"],
  },
  {
    id: "docs-prune",
    title: "Reclaim disk space",
    description: "Remove unused containers, networks, images, and build cache.",
    url: "https://docs.docker.com/config/pruning/",
    keywords: ["cleanup", "prune", "disk", "space", "remove", "unused"],
    commandIds: ["system.prune", "images.prune", "volumes.prune"],
    lessonIds: ["cleanup", "safe-cleanup-advanced"],
  },
  {
    id: "docs-events",
    title: "Monitor Docker events",
    description: "Stream real-time events from the Docker daemon.",
    url: "https://docs.docker.com/engine/reference/commandline/events/",
    keywords: ["events", "monitor", "stream", "watch"],
    commandIds: ["events.stream"],
    lessonIds: ["networks-events"],
  },
  {
    id: "docs-cli",
    title: "Docker CLI reference",
    description: "Complete reference for docker command-line options.",
    url: "https://docs.docker.com/reference/cli/docker/",
    keywords: ["cli", "command", "reference", "flags", "options"],
    lessonIds: ["custom-cli"],
  },
];
