import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface TenantRecord {
    user_id: string;
    username: string;
    secret_tunnel_token: string;
    cloud_storage_directory: string;
    created_at: string;
    active_task_queue: string[];
    tier_status?: string;
    credits_total_monthly?: number;
    credits_used_this_month?: number;
    subscription_expires?: string;
}

export interface BillingRecord {
    user_id: string;
    username: string;
    tier_status: string;
    credits_total_monthly: number;
    credits_used_this_month: number;
    subscription_expires: string;
}

export interface TenantRegistrationResult {
    status: "success" | "error";
    user_id?: string;
    username?: string;
    token?: string;
    script_download_link?: string;
    message?: string;
    script_path?: string;
}

export interface BillingCheckResult {
    status: "PASSED" | "UPGRADE_REQUIRED" | "LIMIT_EXCEEDED" | "error";
    message?: string;
    remaining_credits?: number;
    user_id?: string;
    tier_status?: string;
}

const DEFAULT_DATA_DIR = path.join(process.cwd(), ".lumi-data");
const DIRECTORY_NAMES = ["Financials", "Manuscripts", "System_Logs", "General_Reference"];

const CREDIT_COSTS: Record<string, number> = {
    TEXT_MANUSCRIPT: 1,
    CODE_MATH: 1,
    FILE_INGEST: 2,
    IMAGE_FLUX: 5,
    REMOTE_DESKTOP: 10,
    VIDEO_RENDER: 25,
};

const TIER_PERMISSIONS: Record<string, string[]> = {
    Free: ["TEXT_MANUSCRIPT", "CODE_MATH"],
    Bronze: ["TEXT_MANUSCRIPT", "CODE_MATH", "FILE_INGEST"],
    Silver: ["TEXT_MANUSCRIPT", "CODE_MATH", "FILE_INGEST", "IMAGE_FLUX"],
    Gold: ["TEXT_MANUSCRIPT", "CODE_MATH", "FILE_INGEST", "IMAGE_FLUX", "REMOTE_DESKTOP"],
    Platinum: ["TEXT_MANUSCRIPT", "CODE_MATH", "FILE_INGEST", "IMAGE_FLUX", "REMOTE_DESKTOP", "VIDEO_RENDER"],
    Unlimited: ["TEXT_MANUSCRIPT", "CODE_MATH", "FILE_INGEST", "IMAGE_FLUX", "REMOTE_DESKTOP", "VIDEO_RENDER"],
};

function getDataDir(): string {
    const configured = process.env.LUMI_TENANT_DATA_DIR || DEFAULT_DATA_DIR;
    fs.mkdirSync(configured, {recursive: true});
    return configured;
}

function getUsersPath(): string {
    return path.join(getDataDir(), "users.json");
}

function getBillingPath(): string {
    return path.join(getDataDir(), "billing_ledger.json");
}

function readJsonFile<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) {
        return fallback;
    }

    try {
        const content = fs.readFileSync(filePath, "utf8");
        return JSON.parse(content) as T;
    } catch {
        return fallback;
    }
}

function writeJsonFile(filePath: string, value: unknown): void {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function sanitizeUsername(username: string): string {
    const sanitized = username.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
    let start = 0;
    let end = sanitized.length;

    while (start < end && sanitized[start] === "_") {
        start += 1;
    }
    while (end > start && sanitized[end - 1] === "_") {
        end -= 1;
    }

    return sanitized.slice(start, end) || "guest_user";
}

function createClientScript(username: string, token: string): string {
    return `# SOVEREIGN RUNTIME DESKTOP AGENT FOR USER: ${username}\nimport os, time, requests\nfrom PIL import ImageGrab\n\nCLOUD_SERVER_URL = "https://your-private-ai.com"\nUSER_ACCESS_TOKEN = "${token}"\n\nprint("🔒 Sovereign Client Agent Active for ${username}. Awaiting browser cloud commands...")\nwhile True:\n    try:\n        res = requests.get(f"{CLOUD_SERVER_URL}/fetch_task", headers={"X-Auth-Token": USER_ACCESS_TOKEN}, timeout=10)\n        if res.status_code == 200:\n            task = res.json()\n            if task.get("action") == "SCREEN_CAPTURE":\n                ImageGrab.grab().save("C:\\\\SovereignAI\\\\temp.png")\n                with open("C:\\\\SovereignAI\\\\temp.png", "rb") as f:\n                    requests.post(f"{CLOUD_SERVER_URL}/upload_screen", headers={"X-Auth-Token": USER_ACCESS_TOKEN}, files={"file": f})\n                os.remove("C:\\\\SovereignAI\\\\temp.png")\n    except Exception:\n        time.sleep(5)\n`;
}

export function registerTenant(username: string): TenantRegistrationResult {
    const normalizedUsername = sanitizeUsername(username);
    if (!normalizedUsername || normalizedUsername === "guest_user" && username.trim() === "") {
        return {status: "error", message: "A username is required."};
    }

    const usersPath = getUsersPath();
    const usersList = readJsonFile<TenantRecord[]>(usersPath, []);

    const duplicate = usersList.find((user) => user.username.toLowerCase() === normalizedUsername.toLowerCase());
    if (duplicate) {
        return {status: "error", message: `Username '${normalizedUsername}' already exists.`};
    }

    const userId = `USER-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const secretToken = `Sovereign_${crypto.randomBytes(16).toString("hex")}`;
    const userDir = path.join(getDataDir(), "users", userId);

    try {
        for (const dirName of DIRECTORY_NAMES) {
            fs.mkdirSync(path.join(userDir, dirName), {recursive: true});
        }
    } catch (error: any) {
        return {status: "error", message: `Folder allocation failed: ${error.message}`};
    }

    const tenantRecord: TenantRecord = {
        user_id: userId,
        username: normalizedUsername,
        secret_tunnel_token: secretToken,
        cloud_storage_directory: userDir,
        created_at: new Date().toISOString(),
        active_task_queue: [],
        tier_status: "Free",
        credits_total_monthly: 10,
        credits_used_this_month: 0,
        subscription_expires: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    usersList.push(tenantRecord);
    writeJsonFile(usersPath, usersList);

    const scriptPath = path.join(userDir, "client_agent.py");
    fs.writeFileSync(scriptPath, createClientScript(normalizedUsername, secretToken), "utf8");

    const billingLedgerPath = getBillingPath();
    const billingLedger = readJsonFile<BillingRecord[]>(billingLedgerPath, []);
    billingLedger.push({
        user_id: userId,
        username: normalizedUsername,
        tier_status: "Free",
        credits_total_monthly: 10,
        credits_used_this_month: 0,
        subscription_expires: tenantRecord.subscription_expires || new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    writeJsonFile(billingLedgerPath, billingLedger);

    return {
        status: "success",
        user_id: userId,
        username: normalizedUsername,
        token: secretToken,
        script_download_link: `/api/onboarding/download/${userId}`,
        message: `Account provisioned for ${normalizedUsername}.`,
        script_path: scriptPath,
    };
}

export function getTenantScriptPath(userId: string): string | null {
    const usersPath = getUsersPath();
    const usersList = readJsonFile<TenantRecord[]>(usersPath, []);
    const tenant = usersList.find((entry) => entry.user_id === userId);
    if (!tenant) {
        return null;
    }
    return path.join(tenant.cloud_storage_directory, "client_agent.py");
}

export function enforceBilling(userId: string, requestedAction: string): BillingCheckResult {
    const billingLedgerPath = getBillingPath();
    const ledger = readJsonFile<BillingRecord[]>(billingLedgerPath, []);
    const record = ledger.find((entry) => entry.user_id === userId);

    if (!record) {
        return {status: "error", message: "User profile not found in ledger."};
    }

    if (record.tier_status === "Unlimited") {
        return {status: "PASSED", message: "Unlimited compute cleared.", user_id: userId, tier_status: record.tier_status};
    }

    const actionCost = CREDIT_COSTS[requestedAction] || 1;
    const availableCredits = record.credits_total_monthly - record.credits_used_this_month;
    const allowedActions = TIER_PERMISSIONS[record.tier_status] || [];

    if (!allowedActions.includes(requestedAction) && record.tier_status !== "Platinum") {
        return {
            status: "UPGRADE_REQUIRED",
            message: `The action '${requestedAction}' is locked on the ${record.tier_status} plan. Please upgrade your tier.`,
            user_id: userId,
            tier_status: record.tier_status,
        };
    }

    if (availableCredits < actionCost) {
        return {
            status: "LIMIT_EXCEEDED",
            message: `Insufficient computation credits. You need ${actionCost} credits, but only have ${availableCredits} left this month.`,
            user_id: userId,
            tier_status: record.tier_status,
        };
    }

    record.credits_used_this_month += actionCost;
    writeJsonFile(billingLedgerPath, ledger);

    return {
        status: "PASSED",
        remaining_credits: availableCredits - actionCost,
        user_id: userId,
        tier_status: record.tier_status,
    };
}

export function upgradeBilling(userId: string, tierStatus: string, monthlyCredits: number, subscriptionExpires?: string): BillingCheckResult {
    const billingLedgerPath = getBillingPath();
    const ledger = readJsonFile<BillingRecord[]>(billingLedgerPath, []);
    const record = ledger.find((entry) => entry.user_id === userId);

    if (!record) {
        return {status: "error", message: "User profile not found in ledger."};
    }

    record.tier_status = tierStatus;
    record.credits_total_monthly = monthlyCredits;
    record.credits_used_this_month = 0;
    record.subscription_expires = subscriptionExpires || new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    writeJsonFile(billingLedgerPath, ledger);

    return {status: "PASSED", message: `${tierStatus} plan activated.`, user_id: userId, tier_status: tierStatus};
}

export function getBillingLedger(): BillingRecord[] {
    return readJsonFile<BillingRecord[]>(getBillingPath(), []);
}

export function buildPublicChatResponse(message: string, sessionId?: string): {content: string; ok: boolean; mode: "onboarding" | "billing" | "chat"; payload?: unknown} {
    const normalized = message.toLowerCase();
    const registerMatch = message.match(/username\s*[:=]?\s*([a-zA-Z0-9._-]+)/i) || message.match(/set my username to ([a-zA-Z0-9._-]+)/i);

    if (/(register|sign up|create account|new profile|new user)/i.test(message)) {
        const requestedUsername = registerMatch?.[1] || `guest_${(sessionId || "public").replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
        const result = registerTenant(requestedUsername);
        return {
            content: result.status === "success"
                ? `Welcome aboard! Your account was provisioned for ${result.username}.\n\nUser ID: ${result.user_id}\nSecret token: ${result.token}\nDownload script: ${result.script_download_link}`
                : result.message || "Unable to provision an account.",
            ok: true,
            mode: "onboarding",
            payload: result,
        };
    }

    if (/(video|render|flux|desktop|screen|remote)/i.test(normalized)) {
        const fallbackUserId = `session:${sessionId || "public"}`;
        const billing = enforceBilling(fallbackUserId, "VIDEO_RENDER");
        if (billing.status !== "PASSED") {
            return {
                content: `${billing.message || "Billing gatekeeper blocked the request."}\n\nCreate an account to receive a real user id, then retry with the same user id.`,
                ok: true,
                mode: "billing",
                payload: billing,
            };
        }
    }

    return {content: message, ok: true, mode: "chat"};
}
