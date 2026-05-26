import { Mastra } from "@mastra/core/mastra";
import { asoStrategistAgent } from "./agents.js";
import { asoAuditWorkflow } from "./workflows.js";

/**
 * Single Mastra instance for the process. Workflows + agents are registered
 * here so they can resolve each other at execution time (steps look up the
 * agent via `mastra.getAgent(...)`).
 */
export const mastra = new Mastra({
  agents: { asoStrategist: asoStrategistAgent },
  workflows: { asoAudit: asoAuditWorkflow },
  logger: false
});

export type AppMastra = typeof mastra;
