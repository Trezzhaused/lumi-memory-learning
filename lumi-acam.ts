/**
 * Lumi ACAM – Adaptive Content & Access Manager
 *
 * Security and safety layer for the Trezzhaus environment.
 * Incorporates the same security primitives as TrezzWorld Production Studio
 * (security/AuditLog.ts, security/AuthManager.ts, security/PermissionManager.ts,
 *  security/RoleManager.ts) so the two systems share a compatible security model.
 *
 * Responsibilities:
 *   - Rate limiting per IP
 *   - Origin allow-list enforcement
 *   - Content safety heuristics
 *   - Token-based authentication (optional)
 *   - Audit logging of all security events
 */

import {NextFunction, Request, Response} from "express";

// ---------------------------------------------------------------------------
// AuditLog  (mirrors security/AuditLog.ts in trezzworld-production-studio)
// ---------------------------------------------------------------------------

export type AuditAction =
    | "login" | "logout" | "access" | "create" | "update" | "delete"
    | "publish" | "deploy" | "permission_change" | "role_change"
    | "content_blocked" | "rate_limited" | "origin_blocked" | "other";

export interface AuditEntry {
    id: string;
    userId: string;
    action: AuditAction;
    resource?: string;
    details?: Record<string, unknown>;
    timestamp: string;
    success: boolean;
}

export class AuditLog {
    private readonly entries: AuditEntry[] = [];
    private maxEntries: number;

    constructor(maxEntries = 10_000) {
        this.maxEntries = maxEntries;
    }

    log(
        userId: string,
        action: AuditAction,
        options: {resource?: string; details?: Record<string, unknown>; success?: boolean} = {},
    ): AuditEntry {
        const entry: AuditEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            userId,
            action,
            resource: options.resource,
            details: options.details,
            success: options.success ?? true,
            timestamp: new Date().toISOString(),
        };
        this.entries.push(entry);
        if (this.entries.length > this.maxEntries) this.entries.shift();
        return {...entry};
    }

    query(options: {
        userId?: string;
        action?: AuditAction;
        since?: string;
        limit?: number;
    } = {}): AuditEntry[] {
        let results = [...this.entries];
        if (options.userId) results = results.filter(e => e.userId === options.userId);
        if (options.action) results = results.filter(e => e.action === options.action);
        if (options.since) results = results.filter(e => e.timestamp >= options.since!);
        if (options.limit) results = results.slice(-options.limit);
        return results;
    }

    clear(): void {
        this.entries.length = 0;
    }
}

// ---------------------------------------------------------------------------
// AuthManager  (mirrors security/AuthManager.ts in trezzworld-production-studio)
// ---------------------------------------------------------------------------

export type AuthStatus = "authenticated" | "unauthenticated" | "locked";

export interface AuthSession {
    userId: string;
    token: string;
    createdAt: string;
    expiresAt?: string;
}

export class AuthManager {
    private readonly sessions = new Map<string, AuthSession>();
    private readonly lockedUsers = new Set<string>();

    createSession(userId: string, token: string, expiresAt?: string): AuthSession {
        const session: AuthSession = {userId, token, createdAt: new Date().toISOString(), expiresAt};
        this.sessions.set(token, session);
        return {...session};
    }

    validateToken(token: string): AuthSession {
        const session = this.sessions.get(token);
        if (!session) throw new Error("Invalid token");
        if (this.lockedUsers.has(session.userId)) throw new Error(`User locked: ${session.userId}`);
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
            this.sessions.delete(token);
            throw new Error("Token expired");
        }
        return {...session};
    }

    revokeToken(token: string): boolean {
        return this.sessions.delete(token);
    }

    lockUser(userId: string): void {
        this.lockedUsers.add(userId);
    }

    unlockUser(userId: string): void {
        this.lockedUsers.delete(userId);
    }

    getStatus(userId: string): AuthStatus {
        if (this.lockedUsers.has(userId)) return "locked";
        for (const session of this.sessions.values()) {
            if (session.userId === userId) return "authenticated";
        }
        return "unauthenticated";
    }
}

// ---------------------------------------------------------------------------
// Singleton security instances
// ---------------------------------------------------------------------------

export const auditLog = new AuditLog();
export const authManager = new AuthManager();

// ---------------------------------------------------------------------------
// ACAM configuration
// ---------------------------------------------------------------------------

export interface AcamConfig {
    enabled: boolean;
    allowedOrigins: string[];
    blockedCategories: string[];
    rateLimitPerMinute: number;
    /** If true, every request must carry a valid bearer token. */
    requireAuth: boolean;
}

export const defaultAcamConfig: AcamConfig = {
    enabled: process.env.ACAM_ENABLED !== "false",
    allowedOrigins: process.env.ACAM_ALLOWED_ORIGINS
        ? process.env.ACAM_ALLOWED_ORIGINS.split(",").map(s => s.trim())
        : [],
    blockedCategories: ["violence", "self-harm", "illegal-activity", "personal-data-exfiltration"],
    rateLimitPerMinute: parseInt(process.env.ACAM_RATE_LIMIT || "60", 10),
    requireAuth: process.env.ACAM_REQUIRE_AUTH === "true",
};

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per IP)
// ---------------------------------------------------------------------------

const requestLog: Map<string, number[]> = new Map();

function isRateLimited(ip: string, limitPerMinute: number): boolean {
    if (limitPerMinute === 0) return false;
    const now = Date.now();
    const windowStart = now - 60_000;
    const timestamps = (requestLog.get(ip) || []).filter(t => t > windowStart);
    timestamps.push(now);
    requestLog.set(ip, timestamps);
    return timestamps.length > limitPerMinute;
}

// ---------------------------------------------------------------------------
// Content safety
// ---------------------------------------------------------------------------

export interface SafetyCheckResult {
    safe: boolean;
    reason?: string;
    category?: string;
}

const BLOCKED_PATTERNS: Record<string, RegExp[]> = {
    "violence": [/\b(kill|murder|attack|bomb|shoot)\b/i],
    "self-harm": [/\b(suicide|self.?harm|cut myself)\b/i],
    "illegal-activity": [/\b(hack(?:ing)? illegally|steal|fraud|counterfeit)\b/i],
    "personal-data-exfiltration": [/\b(ssn|social security number|credit.?card.?number)\b/i],
};

export function checkContentSafety(
    text: string,
    config: AcamConfig = defaultAcamConfig
): SafetyCheckResult {
    for (const category of config.blockedCategories) {
        const patterns = BLOCKED_PATTERNS[category] || [];
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                return {safe: false, reason: `Content flagged as '${category}'`, category};
            }
        }
    }
    return {safe: true};
}

// ---------------------------------------------------------------------------
// Express middleware — request-level checks
// ---------------------------------------------------------------------------

export function acamMiddleware(config: AcamConfig = defaultAcamConfig) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!config.enabled) { next(); return; }

        const ip = req.ip || req.socket.remoteAddress || "unknown";

        // Origin check
        if (config.allowedOrigins.length > 0) {
            const origin = req.headers.origin || req.headers.referer || "";
            const allowed = config.allowedOrigins.some(o => origin.startsWith(o));
            if (!allowed) {
                auditLog.log(ip, "origin_blocked", {
                    resource: req.path,
                    details: {origin},
                    success: false,
                });
                console.warn(`[ACAM] Origin blocked: ${origin}`);
                res.status(403).json({error: "Origin not permitted by ACAM policy"});
                return;
            }
        }

        // Rate limit
        if (isRateLimited(ip, config.rateLimitPerMinute)) {
            auditLog.log(ip, "rate_limited", {resource: req.path, success: false});
            console.warn(`[ACAM] Rate limit exceeded: ${ip}`);
            res.status(429).json({error: "Rate limit exceeded"});
            return;
        }

        // Optional bearer-token auth
        if (config.requireAuth) {
            const authHeader = req.headers.authorization || "";
            const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
            try {
                const authSession = authManager.validateToken(token);
                auditLog.log(authSession.userId, "access", {resource: req.path, success: true});
            } catch (err: any) {
                auditLog.log("anonymous", "access", {
                    resource: req.path,
                    details: {error: err.message},
                    success: false,
                });
                res.status(401).json({error: `Unauthorized: ${err.message}`});
                return;
            }
        }

        next();
    };
}

// ---------------------------------------------------------------------------
// Express middleware — body content safety (call after JSON parsing)
// ---------------------------------------------------------------------------

export function acamContentGuard(config: AcamConfig = defaultAcamConfig) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!config.enabled) { next(); return; }

        const bodyText = typeof req.body === "string"
            ? req.body
            : JSON.stringify(req.body || {});

        const result = checkContentSafety(bodyText, config);
        if (!result.safe) {
            const ip = req.ip || req.socket.remoteAddress || "unknown";
            auditLog.log(ip, "content_blocked", {
                resource: req.path,
                details: {reason: result.reason, category: result.category},
                success: false,
            });
            console.warn(`[ACAM] Content guard: ${result.reason}`);
            res.status(400).json({error: result.reason, category: result.category});
            return;
        }

        next();
    };
}
