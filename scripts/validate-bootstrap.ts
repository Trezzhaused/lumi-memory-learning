import path from "node:path";
import {bootstrapEcosystem} from "../lumi-ecosystem";
import {getAdaptiveLearningEvaluationSummary} from "../lumi-memory";

async function main(): Promise<void> {
    const rawArgs = process.argv.slice(2).filter(arg => arg !== "--" && !arg.startsWith("-"));
    const repoArg = rawArgs[0] || process.cwd();
    const repoPath = path.resolve(repoArg);
    const result = await bootstrapEcosystem([{repoPath, sessionId: "bootstrap-validation", tags: ["bootstrap-validation"]}]);
    const evaluation = await getAdaptiveLearningEvaluationSummary();
    console.log(JSON.stringify({target: repoPath, ...result, evaluation}, null, 2));
}

main().catch(error => {
    console.error("Bootstrap validation failed:", error);
    process.exit(1);
});
