// src/routes/dashboard/agent-activity.tsx
import { createFileRoute } from "@tanstack/react-router";
import AgentActivity from "../../components/agent/AgentActivity";

export const Route = createFileRoute("/dashboard/agent-activity")({
  component: AgentActivity,
});
