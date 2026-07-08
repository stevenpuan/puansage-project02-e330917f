// src/routes/dashboard/agent-scopes.tsx
import { createFileRoute } from "@tanstack/react-router";
import AgentScopes from "../../components/agent/AgentScopes";

export const Route = createFileRoute("/dashboard/agent-scopes")({
  component: AgentScopes,
});
