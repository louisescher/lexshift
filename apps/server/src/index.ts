import { serve } from "@hono/node-server";
import { env } from "@lexshift/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { v1_identify } from "./routes/v1/identify";
import { v1_shift } from "./routes/v1/shift";

const app = new Hono();
const port = Number(process.env.PORT ?? 3000);

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

app.post("/v1/identify", v1_identify);
app.post("/v1/shift", v1_shift);

export default app;

const server = serve({
	fetch: app.fetch,
	port,
});

const shutdown = () => {
	server.close();
};

process.on("SIGINT", () => {
	shutdown();
});
process.on("SIGTERM", () => {
	shutdown();
});
