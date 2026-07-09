import path from "node:path";
import {bootstrapEcosystem} from "../lumi-ecosystem";

function parseTargets(rawTargets: string[]): Array<{repoPath: string}> {
    return rawTargets.map(repoPath => ({repoPath: path.resolve(repoPath)}));
}

async function main(): Promise<void> {
    const cliTargets = process.argv.slice(2).filter(Boolean);
    const envTargets = (process.env.LUMI_ECOSYSTEM_REPOS || "")
        .split(",")
        .map(entry => entry.trim())
        .filter(Boolean);
    const targets = parseTargets(cliTargets.length ? cliTargets : envTargets);

    if (!targets.length) {
        console.log("No ecosystem repository targets were provided. Pass repo paths or set LUMI_ECOSYSTEM_REPOS.");
        process.exit(0);
    }

    const result = await bootstrapEcosystem(targets);
    console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
    console.error("Ecosystem bootstrap failed:", error);
    process.exit(1);
});
