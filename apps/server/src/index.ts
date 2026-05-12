import { env } from "@lexshift/env/server";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import { Lexshift } from "lexshift/index";
import {
	TapControlClient,
	TapFirehoseSubscriber,
	TapLexiconHistoryStore,
} from "./tap-history";

const app = new Hono();
const port = Number(process.env.PORT ?? 3000);
const tapHistoryStore = new TapLexiconHistoryStore(env.TAP_HISTORY_DB_PATH);
const tapControlClient = new TapControlClient(env.TAP_URL, env.TAP_ADMIN_PASSWORD);
const tapFirehoseSubscriber = new TapFirehoseSubscriber(
	env.TAP_URL,
	tapHistoryStore,
	env.TAP_ADMIN_PASSWORD,
);
tapFirehoseSubscriber.start();

const identifyRequestSchema = z.object({
	record: z
		.record(z.string(), z.unknown())
		.and(z.object({ $type: z.string().trim().min(1) })),
});

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
	}),
);

app.get("/", (c) => {
	return c.text("OK");
});

app.post("/v1/identify", async (c) => {
	const body = await c.req.json().catch(() => null);
	const parsed = identifyRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid request body",
				details: parsed.error.flatten(),
			},
			400,
		);
	}

	try {
		const identified = await Lexshift.identify(parsed.data.record, {
			historyProvider: async ({ nsid, current }) => {
				await tapControlClient.ensureRepoTracked(current.did);
				return tapHistoryStore.getCandidates({
					did: current.did,
					nsid,
					currentCid: current.cid,
				});
			},
		});

		return c.json(identified, 200);
	} catch (error) {
		return c.json(
			{
				error: "Unable to identify lexicon revision",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			422,
		);
	}
});

export default app;

const server = serve({
  fetch: app.fetch,
  port,
});

const shutdown = async () => {
  await tapFirehoseSubscriber.stop();
  server.close();
};

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
