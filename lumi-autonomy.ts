import {mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {DEFAULT_EXTERNAL_BROWSER_SOURCE_ID, queryExternalBrowserSource} from "./lumi-external-sources";
import {evaluateGuardrailRequest, logGuardrailDecision} from "./lumi-guardrails";

export type AutonomyMode = "research-before-create" | "business-automation" | "local-maintenance" | "finance-maintenance" | "sovereign-autonomy" | "scheduled-automation" | "general";

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

export interface SelfDirectedState {
    activeProjects?: string[];
    projects?: string[];
    focus?: string;
    notes?: string[];
    ledger?: Record<string, unknown>;
    financialRunwayDays?: number;
    context?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface SelfDirectedDirective {
    objective: string;
    rationale: string;
    artifactPath: string;
    planMode: AutonomyMode;
    safe: boolean;
    requiresApproval: boolean;
}

export interface SelfDirectedExecutionResult {
    ok: boolean;
    blocked: boolean;
    message: string;
    directive: SelfDirectedDirective | null;
    artifactPath?: string;
    guardrailReason?: string;
    detail?: string;
}

function slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function resolveWorkspaceArtifactPath(workspaceRoot: string, relativePath: string): string {
    const normalizedWorkspaceRoot = path.resolve(workspaceRoot || process.cwd());
    const candidatePath = path.resolve(normalizedWorkspaceRoot, relativePath);
    const relative = path.relative(normalizedWorkspaceRoot, candidatePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Refusing to write outside workspace root: ${relativePath}`);
    }
    return candidatePath;
}

function isScheduledAutomationPrompt(prompt: string): boolean {
    const normalized = (prompt || "").trim().toLowerCase();
    if (!normalized) return false;

    const markers = [
        /\bcron\b/i,
        /\bdaily brief(?:ing)?\b/i,
        /\bbackground worker(?:s)?\b/i,
        /\blife os\b/i,
        /\bsocial publishing(?: loop)?\b/i,
        /\bpublishing loop\b/i,
        /\bscheduled automation\b/i,
        /\bscheduler(?:s)?\b/i,
    ];

    return markers.some((marker) => marker.test(normalized));
}

function isFinanceMaintenancePrompt(prompt: string): boolean {
    const normalized = (prompt || "").trim().toLowerCase();
    if (!normalized) return false;

   const markers = [
       /\bledger\b/i,
       /\baudit\b/i,
       /\bfinance\b/i,
       /\bfinancial\b/i,
       /\bwallet\b/i,
       /\brunway\b/i,
       /\bscan\b/i,
       /\bfilesystem\b/i,
       /\bfile system\b/i,
       /\bsyntax\b/i,
       /\bbug\b/i,
       /\bmaintenance\b/i,
       /\bcleanup\b/i,
       /\bdefrag\b/i,
   ];

   return markers.some((marker) => marker.test(normalized));
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
    const isScheduledAutomation = isScheduledAutomationPrompt(normalized);
    const isFinanceMaintenance = isFinanceMaintenancePrompt(normalized);
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

    if (isScheduledAutomation) {
        return {
            mode: "scheduled-automation",
            prompt: normalized,
            summary: "Scheduled automation plan for recurring background workflows with reviewable handoffs.",
            steps: [
                {
                    id: "scheduled-1",
                    title: "Persist workflow state and inputs",
                    kind: "analysis",
                    detail: "Create a durable state store for run context, previous outputs, and recovery checkpoints so each cycle can resume safely.",
                    safe: true,
                },
                {
                    id: "scheduled-2",
                    title: "Define the schedule and execution contract",
                    kind: "business",
                    detail: "Map the cadence, time zone, retry policy, and runtime assumptions; leave the actual scheduler or connector recipe as an optional deployment step for later.",
                    safe: true,
                },
                {
                    id: "scheduled-3",
                    title: "Add review and approval gates",
                    kind: "review",
                    detail: "Require explicit approval before destructive actions, external publishing, or owner-side execution and preserve a clear audit trail.",
                    safe: true,
                },
                {
                    id: "scheduled-4",
                    title: "Generate the scheduled artifacts",
                    kind: "workspace",
                    detail: "Produce the documents, media, or workflow outputs for each run and store them in a reviewable artifact path.",
                    safe: true,
                },
                {
                    id: "scheduled-5",
                    title: "Hand off notifications and follow-up actions",
                    kind: "review",
                    detail: "Send concise summaries or approval requests to the owner and downstream systems without bypassing the safety gates.",
                    safe: true,
                },
            ],
            safetyNotes: [
                "Do not perform destructive actions or unrestricted external publishing without explicit approval.",
                "Do not execute owner-side actions without a review gate or owner confirmation.",
                "Keep schedulers and connectors as optional deployment recipes until the workflow is validated.",
            ],
            requiresExternalResearch: false,
        };
    }

    if (isFinanceMaintenance) {
        return {
            mode: "finance-maintenance",
            prompt: normalized,
            summary: "Finance and maintenance plan for ledger audits, local scans, and reviewable upkeep loops.",
            steps: [
                {
                    id: "finance-1",
                    title: "Inspect the ledger or scan target",
                    kind: "analysis",
                    detail: "Confirm the target ledger file, folder, or data source before running any audit or scan workflow.",
                    safe: true,
                },
                {
                    id: "finance-2",
                    title: "Prepare a bounded execution context",
                    kind: "maintenance",
                    detail: "Create or reuse a local output path and keep the execution scope limited to the approved example bundle.",
                    safe: true,
                },
                {
                    id: "finance-3",
                    title: "Run the audit or scan workflow",
                    kind: "workspace",
                    detail: "Execute the approved local example script through the guardrailed action bridge and capture the results.",
                    safe: true,
                },
                {
                    id: "finance-4",
                    title: "Review the result and decide the follow-up",
                    kind: "review",
                    detail: "Inspect the report, flag any follow-up work, and route repair or publication actions through the existing approval gates.",
                    safe: true,
                },
            ],
            safetyNotes: [
                "Do not delete, overwrite, or publish files without explicit approval.",
                "Keep file-system scans and ledger audits inside the approved workspace and example bundle.",
                "Require owner confirmation before any owner-side repair or external publishing loop.",
            ],
            requiresExternalResearch: false,
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

export function buildSelfDirectedDirective(state: SelfDirectedState = {}, options: {workspaceRoot?: string} = {}): SelfDirectedDirective {
    const workspaceRoot = options.workspaceRoot || process.cwd();
    const projects = Array.isArray(state.activeProjects) && state.activeProjects.length
        ? state.activeProjects
        : Array.isArray(state.projects) && state.projects.length
            ? state.projects
            : ["the workspace"];
    const focus = (state.focus || "").trim();
    const notes = Array.isArray(state.notes) ? state.notes.filter(Boolean) : [];
    const ledger = state.ledger && typeof state.ledger === "object" ? state.ledger as Record<string, unknown> : {};
    const runway = typeof state.financialRunwayDays === "number"
        ? state.financialRunwayDays
        : typeof ledger.financial_runway_days === "number"
            ? ledger.financial_runway_days as number
            : undefined;

    const projectSummary = projects.slice(0, 3).join(", ");
    const objective = focus
        ? `Review the current state for ${projectSummary} and write a bounded review note for: ${focus}`
        : `Review the current state for ${projectSummary} and write a bounded review note for the next safe maintenance step`;
    const rationale = runway !== undefined
        ? `The current state includes ${projects.length} active project(s) and a runway estimate of ${runway} days, so the safest next action is to document the next reviewable step without changing any protected systems.`
        : `The current state includes ${projects.length} active project(s), so the safest next action is to document the next reviewable step without changing any protected systems.`;
    const artifactPath = resolveWorkspaceArtifactPath(workspaceRoot, path.join(".data", "self-directed-autonomy.md"));
    const planMode = /\b(ledger|finance|wallet|audit|scan|maintenance|bug|syntax)\b/i.test(focus)
        ? "finance-maintenance"
        : /\b(cron|schedule|social|publish|brief|loop)\b/i.test(focus)
            ? "scheduled-automation"
            : /\b(sovereign|self-hosted|mesh|n8n|secure|auth|token|windows)\b/i.test(focus)
                ? "sovereign-autonomy"
                : /\b(inventory|pricing|business|market|sales)\b/i.test(focus)
                    ? "business-automation"
                    : /\b(clean|repair|optimize|restore|maintenance|filesystem|disk)\b/i.test(focus)
                        ? "local-maintenance"
                        : "general";

    return {
        objective,
        rationale,
        artifactPath,
        planMode,
        safe: true,
        requiresApproval: false,
    };
}

export function executeSelfDirectedDirective(state: SelfDirectedState = {}, options: {workspaceRoot?: string} = {}): SelfDirectedExecutionResult {
    const directive = buildSelfDirectedDirective(state, options);
    const guardrailDecision = evaluateGuardrailRequest(directive.objective);
    if (!guardrailDecision.shouldCallModel) {
        const reason = guardrailDecision.reason;
        logGuardrailDecision({
            event: "self-directed-autonomy-blocked",
            reason,
            objective: directive.objective,
        });
        return {
            ok: false,
            blocked: true,
            message: guardrailDecision.fallbackContent,
            directive,
            guardrailReason: reason,
            detail: "The self-directed objective was blocked by the guardrail evaluator.",
        };
    }

    const report = [
        "# Self-directed autonomy review",
        "",
        `- Objective: ${directive.objective}`,
        `- Rationale: ${directive.rationale}`,
        `- Plan mode: ${directive.planMode}`,
        "- Safety: This action is limited to a reviewable local artifact and does not modify protected systems.",
        "",
        "## Notes",
        ...(Array.isArray(state.notes) && state.notes.length ? state.notes.map(note => `- ${note}`) : ["- No additional notes were supplied."]),
    ].join("\n");

    try {
        mkdirSync(path.dirname(directive.artifactPath), {recursive: true});
        writeFileSync(directive.artifactPath, report, "utf8");
        logGuardrailDecision({
            event: "self-directed-autonomy-executed",
            objective: directive.objective,
            artifactPath: directive.artifactPath,
        });
        return {
            ok: true,
            blocked: false,
            message: `Self-directed autonomy report written to ${directive.artifactPath}`,
            directive,
            artifactPath: directive.artifactPath,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown file write error";
        return {
            ok: false,
            blocked: false,
            message,
            directive,
            detail: "The self-directed autonomy artifact could not be written.",
        };
    }
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
        const result = await queryExternalBrowserSource(DEFAULT_EXTERNAL_BROWSER_SOURCE_ID, researchQuery, {goal: prompt, sessionMode: "anonymous"});
        if (result.ok && result.content) {
            return `Comparative research for ${target}:\n${result.content}`;
        }
    } catch (error) {
        console.warn("[Lumi] Comparative research lookup failed:", error);
        // fall back to a deterministic plan when the automation endpoint is unavailable
    }

    return [
        `Comparative research plan for ${target}:`,
        "- Review three comparable leaders and capture their main features.",
        "- Create a feature matrix for UX, pricing, content, and delivery.",
        "- Translate the matrix into a scoped implementation plan before building.",
    ].join("\n");
}
