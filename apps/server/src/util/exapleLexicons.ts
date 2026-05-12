import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type ExampleLexiconCandidate = {
	nsid: string;
	revision: number;
	lexicon: unknown;
	cid: string;
};

function loadExampleLexiconCandidates(): ExampleLexiconCandidate[] {
	const lexiconDir = fileURLToPath(
		new URL("../../../example-lexicons", import.meta.url),
	);
	const files = readdirSync(lexiconDir)
		.filter((name) => name.endsWith(".json"))
		.sort();

	const candidates: ExampleLexiconCandidate[] = [];
	for (const file of files) {
		const content = readFileSync(`${lexiconDir}/${file}`, "utf8");
		const parsed = JSON.parse(content);

		candidates.push({
			nsid: parsed.id,
			revision: parsed.revision,
			lexicon: parsed,
			cid: `example:${file}`,
		});
	}

	return candidates;
}

export const exampleLexiconCandidates = loadExampleLexiconCandidates();
