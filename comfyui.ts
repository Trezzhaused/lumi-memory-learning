import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import type {GenerationRequest, GenerationResult} from "./lumi-generators";

const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";
const COMFYUI_API_KEY = process.env.COMFYUI_API_KEY || "";
const COMFYUI_WORKFLOW_T2V = process.env.COMFYUI_WORKFLOW_T2V || "docs/comfyui/wan2.1_t2v.json";
const COMFYUI_WORKFLOW_I2V = process.env.COMFYUI_WORKFLOW_I2V || "docs/comfyui/wan2.1_native_i2v.json";
const COMFYUI_TIMEOUT_MS = Number(process.env.COMFYUI_TIMEOUT_MS || 600000);

function resolveRepoPath(relativePath: string): string {
    const candidates = [
        path.resolve(process.cwd(), relativePath),
        path.resolve(__dirname, relativePath),
        path.resolve(__dirname, "..", relativePath),
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
    }

    throw new Error(`Unable to locate ComfyUI workflow file: ${relativePath}`);
}

function sanitizeOutputName(name: string): string {
    const cleaned = name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
    return cleaned || "lumi_output";
}

function buildHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    return {
        ...(COMFYUI_API_KEY ? {Authorization: 'Bearer ' + COMFYUI_API_KEY} : {}),
        ...extraHeaders,
    };
}

function setWidgetValue(workflow: any, nodeId: number, value: string): void {
    const targetNode = workflow.nodes.find((node: any) => node.id === nodeId);
    if (!targetNode) throw new Error(`ComfyUI workflow node ${nodeId} not found`);
    if (!Array.isArray(targetNode.widgets_values)) {
        targetNode.widgets_values = [value];
        return;
    }
    targetNode.widgets_values[0] = value;
}

function buildOutputFilename(prefix: string, extension: string): string {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return sanitizeOutputName(`${prefix}_${suffix}${extension.startsWith(".") ? extension : `.${extension}`}`);
}

function getWorkflowPath(req: GenerationRequest): string {
    return req.imageBase64 || req.imageUrl ? COMFYUI_WORKFLOW_I2V : COMFYUI_WORKFLOW_T2V;
}

function readWorkflow(req: GenerationRequest): any {
    const workflowPath = resolveRepoPath(getWorkflowPath(req));
    const workflow = readFileSync(workflowPath, "utf8");
    return JSON.parse(workflow);
}

function buildWorkflow(req: GenerationRequest): any {
    const workflow = readWorkflow(req);
    const prefix = req.imageBase64 || req.imageUrl ? "lumi_i2v" : "lumi_t2v";
    const outputExtension = req.imageBase64 || req.imageUrl ? "mp4" : "webp";
    const outputFilename = buildOutputFilename(prefix, outputExtension);

    if (req.imageBase64 || req.imageUrl) {
        setWidgetValue(workflow, 7, req.prompt);
        setWidgetValue(workflow, 8, req.negativePrompt || "text, watermark, low quality, blurry, static, frozen");
        setWidgetValue(workflow, 11, outputFilename);
    } else {
        setWidgetValue(workflow, 4, req.prompt);
        setWidgetValue(workflow, 5, req.negativePrompt || "text, watermark, low quality, blurry");
        setWidgetValue(workflow, 9, outputFilename);
    }

    workflow.extra = workflow.extra || {};
    workflow.extra.ds = workflow.extra.ds || {};
    workflow.extra.ds.scale = workflow.extra.ds.scale || 1;
    workflow.extra.ds.offset = workflow.extra.ds.offset || [0, 0];

    return workflow;
}

async function uploadImage(imageBase64: string, imageMimeType: string): Promise<string> {
    const buffer = Buffer.from(imageBase64, "base64");
    const form = new FormData();
    const filename = `lumi_upload_${Date.now()}.${imageMimeType.split("/").pop() || "png"}`;
    form.append("image", new Blob([buffer], {type: imageMimeType || "image/png"}), filename);

    const response = await fetch(`${COMFYUI_BASE_URL}/upload/image`, {
        method: "POST",
        headers: buildHeaders(),
        body: form as any,
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`ComfyUI upload failed (${response.status}): ${detail}`);
    }

    const data = await response.json() as any;
    const uploadedName = data?.name || data?.filename || data?.file || "";
    if (!uploadedName) {
        throw new Error("ComfyUI upload did not return a filename");
    }

    return uploadedName;
}

async function setImageNodeInput(workflow: any, uploadedName: string): Promise<void> {
    const targetNode = workflow.nodes.find((node: any) => node.id === 5);
    if (!targetNode) throw new Error("ComfyUI I2V workflow image input node not found");
    targetNode.widgets_values = [uploadedName];
}

async function waitForOutputFile(baseUrl: string, filename: string): Promise<string> {
    const safeName = encodeURIComponent(filename);
    const candidates = [
        `${baseUrl}/view?filename=${safeName}&type=output`,
        `${baseUrl}/api/view?filename=${safeName}&type=output`,
    ];

    const deadline = Date.now() + COMFYUI_TIMEOUT_MS;
    while (Date.now() < deadline) {
        for (const candidate of candidates) {
            const response = await fetch(candidate, {headers: buildHeaders()});
            if (response.ok) {
                return candidate;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 4000));
    }

    throw new Error(`ComfyUI workflow did not produce output file: ${filename}`);
}

async function submitWorkflow(workflow: any): Promise<string> {
    const response = await fetch(`${COMFYUI_BASE_URL}/prompt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...buildHeaders(),
        },
        body: JSON.stringify({prompt: workflow, client_id: `lumi-${Date.now()}`}),
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`ComfyUI prompt submission failed (${response.status}): ${detail}`);
    }

    const data = await response.json() as any;
    const promptId = data?.prompt_id || data?.id || "";
    if (!promptId) {
        throw new Error("ComfyUI did not return a prompt_id");
    }

    return promptId;
}

async function pollForCompletion(promptId: string): Promise<void> {
    const deadline = Date.now() + COMFYUI_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const response = await fetch(`${COMFYUI_BASE_URL}/history/${promptId}`, {
            headers: buildHeaders(),
        });

        if (!response.ok) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
        }

        const history = await response.json() as any;
        const entry = history?.[promptId];
        if (!entry) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
        }

        if (entry.status?.completed) {
            return;
        }

        if (entry.status?.error) {
            throw new Error(`ComfyUI execution failed: ${entry.status.error}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`ComfyUI workflow timed out after ${COMFYUI_TIMEOUT_MS}ms`);
}

export async function generateVideoComfyUI(req: GenerationRequest): Promise<GenerationResult> {
    const workflow = buildWorkflow(req);

    if (req.imageBase64 || req.imageUrl) {
        let imageBase64 = req.imageBase64 || "";
        if (!imageBase64 && req.imageUrl) {
            const imageResponse = await fetch(req.imageUrl);
            if (!imageResponse.ok) {
                throw new Error(`Unable to download image from ${req.imageUrl}`);
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            imageBase64 = Buffer.from(arrayBuffer).toString("base64");
        }

        if (!imageBase64) {
            throw new Error("ComfyUI I2V requires an image payload");
        }

        const uploadedName = await uploadImage(imageBase64, req.imageMimeType || "image/png");
        await setImageNodeInput(workflow, uploadedName);
    }

    const promptId = await submitWorkflow(workflow);
    await pollForCompletion(promptId);

    const outputNode = req.imageBase64 || req.imageUrl
        ? workflow.nodes.find((node: any) => node.id === 11)
        : workflow.nodes.find((node: any) => node.id === 9);
    const outputFilename = outputNode?.widgets_values?.[0] || "lumi_output";
    const outputUrl = await waitForOutputFile(COMFYUI_BASE_URL, outputFilename);

    const mimeType = outputFilename.toLowerCase().endsWith(".mp4")
        ? "video/mp4"
        : outputFilename.toLowerCase().endsWith(".webp")
            ? "image/webp"
            : "application/octet-stream";

    return {
        type: "video",
        backend: "comfyui",
        model: req.model || (req.imageBase64 || req.imageUrl ? "wan2.1-i2v" : "wan2.1-t2v"),
        url: outputUrl,
        prompt: req.prompt,
        mimeType,
        createdAt: new Date().toISOString(),
    };
}
