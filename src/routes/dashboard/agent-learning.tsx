// src/routes/dashboard/agent-learning.tsx
import { createFileRoute } from "@tanstack/react-router";
import AgentLearning from "../../components/agent/AgentLearning";

export const Route = createFileRoute("/dashboard/agent-learning")({
  component: AgentLearning,
});
