import type { Context } from "hono";
import type { BlankEnv, BlankInput } from "hono/types";
import { shift } from "lexshift";
import z from "zod";
import { exampleLexiconCandidates } from "@/util/exapleLexicons";

const shiftRequestSchema = z.object({
	record: z
		.record(z.string(), z.unknown())
		.and(z.object({ $type: z.string().trim().min(1) })),
	target: z.number(),
});

export const v1_shift = async (
	c: Context<BlankEnv, "/v1/identify", BlankInput>,
) => {
	const body = await c.req.json().catch(() => null);
	const parsed = shiftRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid request body",
				details: z.treeifyError(parsed.error),
			},
			400,
		);
	}

	try {
		const shiftResult = await shift(parsed.data.record, parsed.data.target, {
			historyProvider: async ({ nsid, current }) => {
				return exampleLexiconCandidates
					.filter((candidate) => candidate.nsid === nsid)
					.filter((candidate) => candidate.revision < current.revision)
					.sort((a, b) => b.revision - a.revision)
					.map((candidate) => ({
						revision: candidate.revision,
						lexicon: candidate.lexicon,
						cid: candidate.cid,
					}));
			},
		});

		return c.json(shiftResult, 200);
	} catch (error) {
		return c.json(
			{
				error: "Unable to shift record to lexicon revision",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			422,
		);
	}
};
