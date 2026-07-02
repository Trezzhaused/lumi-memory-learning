import {queryExternalBrowserSource} from "./lumi-external-sources";

export type AutonomyMode = "research-before-create" | "business-automation" | "local-maintenance" | "sovereign-autonomy" | "general";

export interface AutonomyPlanStep {
    id: string;
    title: string;
    kind: "research" | "analysis" | "workspace" | "maintenance" | "business" | "review";
    detail: string;
    safe: boolean;
}

export interface AutonomyPlan {
    mode: AutonomyMode;
    prompt: string;
    summary: string;
    steps: AutonomyPlanStep[];
    safetyNotes: string[];
    requiresExternalResearch: boolean;
    comparativeTarget?: string | null;
}

function slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function isSovereignAutonomyPrompt(prompt: string): boolean {
    const normalized = (prompt || "").trim().toLowerCase();
    if (!normalized) return false;

    const securityMarkers = /\b(sovereign|self-hosted|self hosted|independence|autonomy|secure|security|authentication|auth|webhook|token|n8n|windows|chat trigger|listener|offline|local-first|local first)\b/i;
    const executionMarkers = /\b(audio|video|image|document|pdf|spreadsheet|voice|workflow|pipeline|tool|agent|database|schema|server|host|endpoint|mesh|loop|self-healing|self healing)\b/i;

    return securityMarkers.test(normalized) && executionMarkers.test(normalized);
}

export function buildAutonomyPlan(prompt: string, options: {workspaceRoot?: string} = {}): AutonomyPlan {
    const normalized = (prompt || "").trim();
    const lower = normalized.toLowerCase();
    const workspaceRoot = options.workspaceRoot || process.cwd();

    const isResearchBeforeCreate = /\b(create|build|make|design|ship|launch|clone|prototype|draft|website|app|landing page|dashboard|product|system)\b/i.test(lower)
        && /\b(like|similar|inspired by|based on|clone of|modeled after|as|copy of)\b/i.test(lower);
    const isBusinessAutomation = /\b(inventory|pricing|price|stock|sales|business|crm|slack|airtable|competitor|market)\b/i.test(lower);
    const isLocalMaintenance = /\b(clean|defrag|disk|repair|virus|scan|maintenance|windows|computer|optimize|cleanup)\b/i.test(lower);

    if (isResearchBeforeCreate) {
        const comparativeTarget = extractComparativeTarget(normalized) || "the requested experience";
        return {
            mode: "research-before-create",
            prompt: normalized,
            summary: `Research-first creation plan for ${comparativeTarget}.`,
            steps: [
                {
                    id: "research-1",
                    title: `Research ${comparativeTarget} and 3 comparable leaders`,
                    kind: "research",
                    detail: "Gather public references, compare feature sets, and create a short matrix before implementation.",
                    safe: true,
                },
                {
                    id: "analysis-1",
                    title: "Translate the comparison into requirements",
                    kind: "analysis",
                    detail: "Convert the feature matrix into a scoped implementation checklist, priorities, and acceptance criteria.",
                    safe: true,
                },
                {
                    id: "workspace-1",
                    title: "Generate a starter implementation in the workspace",
                    kind: "workspace",
                    detail: `Create files and code in ${workspaceRoot} for the first safe prototype.`,
                    safe: true,
                },
                {
                    id: "review-1",
                    title: "Validate the deliverable and capture lessons",
                    kind: "review",
                    detail: "Check the output, record any gaps, and preserve notes for future recall.",
                    safe: true,
                },
            ],
            safetyNotes: [
                "Use public research only and avoid copying proprietary assets or secrets.",
                "Keep changes scoped to the workspace and do not execute destructive system commands.",
            ],
            requiresExternalResearch: process.env.LUMI_ALLOW_EXTERNAL_RESEARCH !== "false",
            comparativeTarget,
        };
    }

    if (isSovereignAutonomyPrompt(normalized)) {
        return {
            mode: "sovereign-autonomy",
            prompt: normalized,
            summary: "Sovereign autonomy plan for secure self-hosted workflows and multi-modal execution.",
            steps: [
                {
                    id: "sovereign-1",
                    title: "Assess the public control surface",
                    kind: "analysis",
                    detail: "Audit public endpoints, authentication, tokens, and owner-side bridges before enabling network access.",
                    safe: true,
                },
                {
                    id: "sovereign-2",
                    title: "Define the local data and workflow schema",
                    kind: "business",
                    detail: "Create the inventory, pricing, site, or workflow schema and a safe persistence path for local execution.",
                    safe: true,
                },
                {
                    id: "sovereign-3",
                    title: "Wire the multi-modal execution mesh",
                    kind: "workspace",
                    detail: "Connect image, audio, video, document, and tool-execution specialists with a self-healing loop.",
                    safe: true,
                },
                {
                    id: "sovereign-4",
                    title: "Validate and lock the deployment",
                    kind: "review",
                    detail: "Run deterministic checks, verify access controls, and record the rollout plan for future recall.",
                    safe: true,
                },
            ],
            safetyNotes: [
                "Keep public entry points behind authentication and approval gates.",
                "Avoid destructive local commands unless explicitly authorized.",
                "Prefer self-hosted components and local data stores for sovereignty.",
            ],
            requiresExternalResearch: false,
        };
    }

    if (isBusinessAutomation) {
        return {
            mode: "business-automation",
            prompt: normalized,
            summary: "Business automation plan for inventory, pricing, and workflow updates.",
            steps: [
                {
                    id: "business-1",
                    title: "Inspect the business data source",
                    kind: "business",
                    detail: "Map the inventory, pricing, and workflow state before making changes.",
                    safe: true,
                },
                {
                    id: "business-2",
                    title: "Draft the automation policy",
                    kind: "analysis",
                    detail: "Define guardrails for stock thresholds, price changes, and notifications.",
                    safe: true,
                },
                {
                    id: "business-3",
                    title: "Implement the workflow",
                    kind: "workspace",
                    detail: "Persist the automation steps and create a safe, reviewable implementation path.",
                    safe: true,
                },
            ],
            safetyNotes: [
                "Only update approved inventory and pricing data sources.",
                "Require human review for destructive or revenue-affecting changes.",
            ],
            requiresExternalResearch: process.env.LUMI_ALLOW_EXTERNAL_RESEARCH !== "false",
        };
    }

    if (isLocalMaintenance) {
        return {
            mode: "local-maintenance",
            prompt: normalized,
            summary: "Safe local maintenance plan for repair and cleanup tasks.",
            steps: [
                {
                    id: "maintenance-1",
                    title: "Capture a pre-maintenance snapshot",
                    kind: "maintenance",
                    detail: "Record the current files, logs, and state before any cleanup operation.",
                    safe: true,
                },
                {
                    id: "maintenance-2",
                    title: "Run a bounded cleanup routine",
                    kind: "maintenance",
                    detail: "Use only allow-listed commands and stay inside the declared workspace.",
                    safe: true,
                },
                {
                    id: "maintenance-3",
                    title: "Verify the result",
                    kind: "review",
                    detail: "Confirm that files, logs, and the workspace remain intact after the run.",
                    safe: true,
                },
            ],
            safetyNotes: [
                "Avoid destructive system operations without explicit approval.",
                "Keep command execution within the allow-list and workspace guardrails.",
            ],
            requiresExternalResearch: false,
        };
    }

    return {
        mode: "general",
        prompt: normalized,
        summary: "General Lumi assistance plan.",
        steps: [
            {
                id: `general-${slug(normalized || "request")}`,
                title: "Clarify the request and produce a safe next step",
                kind: "analysis",
                detail: "Break the request into a clear set of next actions and keep the response bounded by safety rules.",
                safe: true,
            },
        ],
        safetyNotes: [
            "Prefer transparent, reviewable actions over irreversible changes.",
        ],
        requiresExternalResearch: false,
    };
}

function extractComparativeTarget(prompt: string): string | null {
    const normalizedPrompt = prompt.trim();
    const lowerPrompt = normalizedPrompt.toLowerCase();
    const markers = ["like ", "similar to ", "similar ", "inspired by ", "clone of ", "modeled after ", "based on ", "copy of "];

    for (const marker of markers) {
        const markerIndex = lowerPrompt.indexOf(marker);
        if (markerIndex >= 0) {
            const tail = normalizedPrompt.slice(markerIndex + marker.length).trim();
            const firstToken = tail.split(/\s+/)[0]?.replace(/[.,;:!?]/g, "");
            if (firstToken) return firstToken;
        }
    }

    const likeMarker = lowerPrompt.indexOf(" like ");
    if (likeMarker >= 0) {
        const tail = normalizedPrompt.slice(likeMarker + 6).trim();
        const firstToken = tail.split(/\s+/)[0]?.replace(/[.,;:!?]/g, "");
        if (firstToken) return firstToken;
    }

    return null;
}

export async function buildComparativeResearchContext(prompt: string): Promise<string | null> {
    const plan = buildAutonomyPlan(prompt);
    if (plan.mode !== "research-before-create") return null;

    const target = plan.comparativeTarget || extractComparativeTarget(prompt) || "the requested product";
    const researchQuery = `Compare ${target} against three comparable leaders and produce a concise feature matrix with UX, pricing, and implementation notes.`;

    try {
        const result = await queryExternalBrowserSource("yuanbao", researchQuery, {goal: prompt, sessionMode: "anonymous"});
        if (result.ok && result.content) {
            return `Comparative research for ${target}:\n${result.content}`;
        }
    } catch {
        // fall back to a deterministic plan when the automation endpoint is unavailable
    }

    return [
        `Comparative research plan for ${target}:`,
        "- Review three comparable leaders and capture their main features.",
        "- Create a feature matrix for UX, pricing, content, and delivery.",
        "- Translate the matrix into a scoped implementation plan before building.",
    ].join("\n");
}
