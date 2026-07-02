/**
 * lumi-conversation.ts
 *
 * ConversationManager for Lumi — directly ported from the
 * TrezzWorld Production Studio (lumi/ConversationManager.ts) so that
 * sessions created here are structurally identical to those in the Studio.
 */

export type ConversationRole = "system" | "user" | "assistant" | "tool" | "agent";

export interface ConversationMetadata {
    [key: string]: unknown;
}

export interface ConversationMessage {
    id: string;
    role: ConversationRole;
    content: string;
    timestamp: string;
    metadata?: ConversationMetadata;
}

export interface ConversationSession {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    archived: boolean;
    messages: ConversationMessage[];
    metadata?: ConversationMetadata;
}

export interface ConversationSummary {
    sessionId: string;
    title: string;
    totalMessages: number;
    lastUpdated: string;
    summary: string;
}

export interface ContextWindowOptions {
    maxMessages?: number;
    includeSystem?: boolean;
    roles?: ConversationRole[];
}

export interface SearchOptions {
    role?: ConversationRole;
    since?: string;
    limit?: number;
}

export class ConversationManager {
    private readonly sessions = new Map<string, ConversationSession>();

    // ── Session lifecycle ────────────────────────────────────────────────

    create(title: string, metadata?: ConversationMetadata, id?: string): ConversationSession {
        const now = new Date().toISOString();
        const session: ConversationSession = {
            id: id || this.generateId(),
            title,
            createdAt: now,
            updatedAt: now,
            archived: false,
            messages: [],
            metadata,
        };
        this.sessions.set(session.id, session);
        return this.clone(session);
    }

    get(sessionId: string): ConversationSession | undefined {
        const s = this.sessions.get(sessionId);
        return s ? this.clone(s) : undefined;
    }

    list(includeArchived = false): ConversationSession[] {
        return [...this.sessions.values()]
            .filter(s => includeArchived || !s.archived)
            .map(s => this.clone(s));
    }

    archive(sessionId: string): ConversationSession {
        const session = this.require(sessionId);
        session.archived = true;
        session.updatedAt = new Date().toISOString();
        return this.clone(session);
    }

    delete(sessionId: string): boolean {
        return this.sessions.delete(sessionId);
    }

    updateMetadata(sessionId: string, metadata: ConversationMetadata): ConversationSession {
        const session = this.require(sessionId);
        session.metadata = {...session.metadata, ...metadata};
        session.updatedAt = new Date().toISOString();
        return this.clone(session);
    }

    // ── Message management ───────────────────────────────────────────────

    addMessage(
        sessionId: string,
        role: ConversationRole,
        content: string,
        metadata?: ConversationMetadata,
    ): ConversationMessage {
        const session = this.require(sessionId);
        const message: ConversationMessage = {
            id: this.generateId(),
            role,
            content,
            timestamp: new Date().toISOString(),
            metadata,
        };
        session.messages.push(message);
        session.updatedAt = message.timestamp;
        return {...message};
    }

    getMessages(sessionId: string): ConversationMessage[] {
        return this.require(sessionId).messages.map(m => ({...m}));
    }

    clearMessages(sessionId: string): void {
        const session = this.require(sessionId);
        session.messages = [];
        session.updatedAt = new Date().toISOString();
    }

    // ── Context window ───────────────────────────────────────────────────

    getContextWindow(sessionId: string, options: ContextWindowOptions = {}): ConversationMessage[] {
        const {maxMessages, includeSystem = true, roles} = options;
        let messages = this.require(sessionId).messages.map(m => ({...m}));
        if (!includeSystem) messages = messages.filter(m => m.role !== "system");
        if (roles && roles.length > 0) messages = messages.filter(m => roles.includes(m.role));
        if (maxMessages !== undefined && maxMessages > 0) messages = messages.slice(-maxMessages);
        return messages;
    }

    // ── Summarization ────────────────────────────────────────────────────

    summarize(sessionId: string): ConversationSummary {
        const session = this.require(sessionId);
        const nonSystem = session.messages.filter(m => m.role !== "system");
        const last = nonSystem[nonSystem.length - 1];
        const summary =
            nonSystem.length === 0
                ? "No messages yet."
                : `${nonSystem.length} message(s). Last from "${last.role}": "${last.content.slice(0, 120)}${last.content.length > 120 ? "\u2026" : ""}"`;
        return {
            sessionId: session.id,
            title: session.title,
            totalMessages: session.messages.length,
            lastUpdated: session.updatedAt,
            summary,
        };
    }

    // ── Search ───────────────────────────────────────────────────────────

    searchMessages(sessionId: string, query: string, options: SearchOptions = {}): ConversationMessage[] {
        const {role, since, limit} = options;
        const lq = query.toLowerCase();
        let messages = this.require(sessionId).messages.map(m => ({...m}));
        if (role) messages = messages.filter(m => m.role === role);
        if (since) messages = messages.filter(m => m.timestamp >= since);
        messages = messages.filter(m => m.content.toLowerCase().includes(lq));
        if (limit !== undefined && limit > 0) messages = messages.slice(0, limit);
        return messages;
    }

    // ── Private helpers ──────────────────────────────────────────────────

    private require(id: string): ConversationSession {
        const s = this.sessions.get(id);
        if (!s) throw new Error(`ConversationSession not found: ${id}`);
        return s;
    }

    private clone(session: ConversationSession): ConversationSession {
        return {
            ...session,
            messages: session.messages.map(m => ({...m})),
            metadata: session.metadata ? {...session.metadata} : undefined,
        };
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
}
