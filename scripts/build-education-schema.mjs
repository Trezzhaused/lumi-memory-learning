import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "data", "educational-datasets");
const outputPath = path.join(outputDir, "education-schema.jsonl");
const manifestPath = path.join(outputDir, "manifest.json");
const userAgent = process.env.EDUCATION_DATASET_USER_AGENT || "Mozilla/5.0 (compatible; LumiEducationSchemaBuilder/1.0; +https://github.com/Trezzhaused/lumi-memory-learning)";

const bookSlug = process.env.EDUCATION_BOOK_SLUG || "college-physics-2e";
const gradeLevel = process.env.EDUCATION_GRADE_LEVEL || "Grade 8";
const subject = process.env.EDUCATION_SUBJECT || "Physical Science";
const domainId = process.env.EDUCATION_DOMAIN_ID || "SCI.G8.PS.01";
const domainTitle = process.env.EDUCATION_DOMAIN_TITLE || "Matter and Its Interactions";
const standardAlignment = process.env.EDUCATION_STANDARD_ALIGNMENT || "NGSS.MS-PS1-1";

const rawData = await fetchBookStructure(bookSlug);
const dataset = transformToSchema(rawData, {
    bookSlug,
    gradeLevel,
    subject,
    domainId,
    domainTitle,
    standardAlignment,
});

await mkdir(outputDir, {recursive: true});
await writeFile(outputPath, dataset.map(item => JSON.stringify(item)).join("\n") + "\n");
await writeFile(manifestPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceBookSlug: bookSlug,
    outputFile: path.relative(repoRoot, outputPath).split(path.sep).join("/"),
    itemCount: dataset.length,
    gradeLevel,
    subject,
    domainId,
    domainTitle,
    standardAlignment,
}, null, 2) + "\n");

console.log(`[education-schema] wrote ${dataset.length} lesson nodes to ${path.relative(repoRoot, outputPath)}`);

async function fetchBookStructure(bookSlug) {
    const apiUrl = `https://openstax.org/${bookSlug}`;
    try {
        const response = await fetch(apiUrl, {headers: {"User-Agent": userAgent}});
        if (!response.ok) {
            return null;
        }
        const payload = await response.json().catch(() => null);
        return payload;
    } catch {
        return null;
    }
}

function transformToSchema(apiData, options) {
    const fallbackNodes = [
        {
            grade_level: options.gradeLevel,
            subject: options.subject,
            domain_id: options.domainId,
            domain_title: options.domainTitle,
            standard_alignment: options.standardAlignment,
            curriculum_tree: {
                module_id: "MOD_01",
                module_title: "Atomic Structure and Elements",
                lessons: [
                    {
                        lesson_id: "LES_01_001",
                        lesson_title: "The Structure of an Atom",
                        prerequisites: ["SCI.G7.PS.00"],
                        learning_objectives: [
                            "Identify protons, neutrons, and electrons.",
                            "Describe the location and charge of subatomic particles.",
                        ],
                        content_body: "An atom is the basic unit of a chemical element. It consists of a central nucleus containing protons (positively charged) and neutrons (neutral), surrounded by electrons (negatively charged) orbiting in energy levels.",
                        vocabulary: [
                            {term: "Nucleus", definition: "The dense central core of an atom."},
                            {term: "Electron", definition: "A negatively charged subatomic particle."},
                        ],
                        assessments: [
                            {
                                question_id: "Q_01_001_A1",
                                type: "multiple_choice",
                                difficulty: "Easy",
                                question_text: "Which subatomic particle carries a positive electric charge?",
                                options: {
                                    A: "Electron",
                                    B: "Neutron",
                                    C: "Proton",
                                    D: "Photon",
                                },
                                correct_answer: "C",
                                detailed_explanation: "Protons have a positive charge (+1), electrons have a negative charge (-1), and neutrons have no charge (0).",
                            },
                        ],
                    },
                ],
            },
        },
    ];

    if (!apiData || typeof apiData !== "object") {
        return fallbackNodes;
    }

    const children = Array.isArray(apiData.children) ? apiData.children : [];
    if (children.length === 0) {
        return fallbackNodes;
    }

    const nodes = [];
    for (const [unitIndex, unit] of children.entries()) {
        const unitTitle = unit?.title || `Unit ${unitIndex + 1}`;
        const lessons = Array.isArray(unit?.children) ? unit.children : [];
        for (const [lessonIndex, lesson] of lessons.entries()) {
            const lessonTitle = lesson?.title || `Lesson ${lessonIndex + 1}`;
            const pageId = lesson?.id || `node-${unitIndex}-${lessonIndex}`;
            nodes.push({
                grade_level: options.gradeLevel,
                subject: options.subject,
                domain_id: `${options.domainId}.${unitIndex + 1}`,
                domain_title: unitTitle,
                standard_alignment: options.standardAlignment,
                curriculum_tree: {
                    module_id: `MOD_${String(unitIndex + 1).padStart(2, "0")}_${String(lessonIndex + 1).padStart(2, "0")}`,
                    module_title: lessonTitle,
                    lessons: [
                        {
                            lesson_id: `LES_${String(pageId).replace(/[^a-zA-Z0-9]+/g, "_")}`,
                            lesson_title: lessonTitle,
                            source_api_node: `https://openstax.org/${options.bookSlug}/${pageId}/`,
                            content_body: `Placeholder: Content text can be dynamically crawled from the raw HTML page endpoint using page_id ${pageId}.`,
                            assessments: [
                                {
                                    question_id: `Q_${String(pageId).replace(/[^a-zA-Z0-9]+/g, "_")}_01`,
                                    type: "conceptual_qa",
                                    question_text: `Review exercises associated with section: ${lessonTitle}.`,
                                    correct_answer: "Fetchable via the OpenStax Exercises API database mapping.",
                                },
                            ],
                        },
                    ],
                },
            });
        }
    }

    return nodes.length > 0 ? nodes : fallbackNodes;
}
