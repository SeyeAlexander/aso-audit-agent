import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const skillPath = resolve(here, "../../../skills/aso-audit-methodology/SKILL.md");

/**
 * The audit methodology lives as a workspace skill so it can be edited by
 * non-engineers (PMs, marketing) without touching code. We load it at boot
 * and inject the body (minus the frontmatter) as the agent's system prompt.
 */
export function loadAsoAuditMethodology(): string {
  const raw = readFileSync(skillPath, "utf8");
  return stripFrontmatter(raw).trim();
}

function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) return markdown;
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return markdown;
  return markdown.slice(end + 4);
}
