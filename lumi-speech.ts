import {promises as fs} from "node:fs";
import os from "node:os";
import path from "node:path";

export interface SpeechTranscriptionResult {
    ok: boolean;
    text?: string;
    provider?: string;
    error?: string;
}

export interface SpeechSynthesisResult {
    ok: boolean;
    mimeType?: string;
    audioBase64?: string;
    audioDataUrl?: string;
    provider?: string;
    error?: string;
}

export interface SpeechConverseResult {
    ok: boolean;
    transcript?: string;
    reply?: string;
    braille?: string;
    audio?: SpeechSynthesisResult;
    error?: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1";
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || "whisper-1";
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";

function getTempFilePath(ext: string): string {
    return path.join(os.tmpdir(), `lumi-speech-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
}

function normalizeBase64Input(input: string): string {
    return input.replace(/^data:audio\/[^;]+;base64,/, "").trim();
}

async function writeTempAudioFile(audioBase64: string, mimeType: string): Promise<string> {
    const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : mimeType.includes("ogg") ? "ogg" : "bin";
    const filePath = getTempFilePath(ext);
    const buffer = Buffer.from(normalizeBase64Input(audioBase64), "base64");
    await fs.writeFile(filePath, buffer);
    return filePath;
}

export async function transcribeAudio(audioBase64: string, mimeType = "audio/webm"): Promise<SpeechTranscriptionResult> {
    if (!audioBase64) {
        return {ok: false, error: "audioBase64 is required"};
    }

    if (OPENAI_API_KEY) {
        try {
            const filePath = await writeTempAudioFile(audioBase64, mimeType);
            const fileBuffer = await fs.readFile(filePath);
            const formData = new FormData();
            const blob = new Blob([fileBuffer], {type: mimeType});
            formData.append("file", blob, `input.${mimeType.includes("wav") ? "wav" : "webm"}`);
            formData.append("model", OPENAI_STT_MODEL);
            formData.append("response_format", "text");

            const res = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
                method: "POST",
                headers: {Authorization: "Bearer " + OPENAI_API_KEY},
                body: formData as any,
            });

            if (!res.ok) {
                const text = await res.text();
                return {ok: false, error: `OpenAI STT failed (${res.status}): ${text}`};
            }

            const text = await res.text();
            return {ok: true, text: text.trim(), provider: "openai"};
        } catch (error) {
            return {ok: false, error: error instanceof Error ? error.message : "Audio transcription failed"};
        }
    }

    return {
        ok: false,
        error: "No speech-to-text backend configured. Set OPENAI_API_KEY to enable server-side transcription.",
    };
}

export async function speakText(text: string, options: {voice?: string; format?: string} = {}): Promise<SpeechSynthesisResult> {
    if (!text || !text.trim()) {
        return {ok: false, error: "text is required"};
    }

    if (OPENAI_API_KEY) {
        try {
            const res = await fetch(`${OPENAI_API_URL}/audio/speech`, {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + OPENAI_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: OPENAI_TTS_MODEL,
                    input: text,
                    voice: options.voice || "alloy",
                    response_format: options.format || "mp3",
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                return {ok: false, error: `OpenAI TTS failed (${res.status}): ${errorText}`};
            }

            const arrayBuffer = await res.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            const mimeType = options.format === "wav" ? "audio/wav" : options.format === "ogg" ? "audio/ogg" : "audio/mpeg";
            return {
                ok: true,
                mimeType,
                audioBase64: base64,
                audioDataUrl: `data:${mimeType};base64,${base64}`,
                provider: "openai",
            };
        } catch (error) {
            return {ok: false, error: error instanceof Error ? error.message : "Speech synthesis failed"};
        }
    }

    return {
        ok: false,
        error: "No text-to-speech backend configured. Set OPENAI_API_KEY to enable server-side speech output.",
    };
}

export function formatBraille(text: string): string {
    const brailleMap: Record<string, string> = {
        a: "⠁", b: "⠃", c: "⠉", d: "⠙", e: "⠑", f: "⠋", g: "⠛", h: "⠓", i: "⠊", j: "⠚",
        k: "⠅", l: "⠇", m: "⠍", n: "⠝", o: "⠕", p: "⠏", q: "⠟", r: "⠗", s: "⠎", t: "⠞",
        u: "⠥", v: "⠧", w: "⠺", x: "⠭", y: "⠽", z: "⠵",
        A: "⠠⠁", B: "⠠⠃", C: "⠠⠉", D: "⠠⠙", E: "⠠⠑", F: "⠠⠋", G: "⠠⠛", H: "⠠⠓", I: "⠠⠊", J: "⠠⠚",
        K: "⠠⠅", L: "⠠⠇", M: "⠠⠍", N: "⠠⠝", O: "⠠⠕", P: "⠠⠏", Q: "⠠⠟", R: "⠠⠗", S: "⠠⠎", T: "⠠⠞",
        U: "⠠⠥", V: "⠠⠧", W: "⠠⠺", X: "⠠⠭", Y: "⠠⠽", Z: "⠠⠵",
        "0": "⠼⠚", "1": "⠼⠁", "2": "⠼⠃", "3": "⠼⠉", "4": "⠼⠙", "5": "⠼⠑", "6": "⠼⠋", "7": "⠼⠛", "8": "⠼⠓", "9": "⠼⠊",
        ",": "⠂", ".": "⠲", "!": "⠖", "?": "⠦", "(": "⠐⠣", ")": "⠐⠜", "-": "⠤", ":": "⠒", ";": "⠆", "'": "⠄", '"': "⠐⠴", " ": " ",
    };

    return Array.from(text).map(char => brailleMap[char] || char).join("");
}

export async function converseSpeech(
    audioBase64: string,
    mimeType: string,
    sessionId: string,
    chatBody: Record<string, any> = {}
): Promise<SpeechConverseResult> {
    const transcript = await transcribeAudio(audioBase64, mimeType);
    if (!transcript.ok || !transcript.text) {
        return {ok: false, error: transcript.error || "Speech transcription failed"};
    }

    const {lumiChat} = await import("./lumi");
    const reply = await lumiChat({message: transcript.text, ...chatBody}, sessionId);
    const braille = formatBraille(reply.content);
    const audio = await speakText(reply.content);

    return {
        ok: true,
        transcript: transcript.text,
        reply: reply.content,
        braille,
        audio,
    };
}
