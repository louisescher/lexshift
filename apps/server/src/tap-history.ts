import { Tap, SimpleIndexer, type RecordEvent, type TapChannel } from "@atproto/tap";
import Database from "better-sqlite3";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const LEXICON_COLLECTION = "com.atproto.lexicon.schema";

const lexiconHistory = sqliteTable("lexicon_history", {
  cid: text("cid").primaryKey(),
  did: text("did").notNull(),
  nsid: text("nsid").notNull(),
  rev: text("rev"),
  revision: integer("revision").notNull(),
  lexiconJson: text("lexicon_json").notNull(),
  receivedAt: text("received_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

type LexiconHistoryCandidate = {
  revision: number;
  lexicon: unknown;
  cid: string;
};

export class TapLexiconHistoryStore {
  private readonly sqlite: Database.Database;
  private readonly db: ReturnType<typeof drizzle>;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.sqlite = new Database(databasePath);
    this.db = drizzle(this.sqlite);
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS lexicon_history (
        cid TEXT PRIMARY KEY,
        did TEXT NOT NULL,
        nsid TEXT NOT NULL,
        rev TEXT,
        revision INTEGER NOT NULL,
        lexicon_json TEXT NOT NULL,
        received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_lexicon_history_lookup
      ON lexicon_history (did, nsid, revision DESC)
    `);
  }

  public ingestFromRecordEvent(event: RecordEvent) {
    if (!isLexiconRecordEvent(event)) {
      return;
    }

    const revision = event.record.revision ?? 1;
    const nsid = event.record.id;
    const cid = event.cid;
    if (!cid) {
      return;
    }

    this.db
      .insert(lexiconHistory)
      .values({
        cid,
        did: event.did,
        nsid,
        rev: event.rev ?? null,
        revision,
        lexiconJson: JSON.stringify(event.record),
      })
      .onConflictDoNothing({ target: lexiconHistory.cid })
      .run();
  }

  public getCandidates(params: {
    did: string;
    nsid: string;
    currentCid: string;
  }): LexiconHistoryCandidate[] {
    const rows = this.db
      .select({
        cid: lexiconHistory.cid,
        revision: lexiconHistory.revision,
        lexiconJson: lexiconHistory.lexiconJson,
      })
      .from(lexiconHistory)
      .where(
        and(
          eq(lexiconHistory.did, params.did),
          eq(lexiconHistory.nsid, params.nsid),
          ne(lexiconHistory.cid, params.currentCid),
        ),
      )
      .orderBy(desc(lexiconHistory.revision))
      .all();

    return rows.map((row) => ({
      cid: row.cid,
      revision: row.revision,
      lexicon: JSON.parse(row.lexiconJson),
    }));
  }
}

export class TapControlClient {
  private readonly trackedRepos = new Set<string>();
  private readonly tap: Tap;

  constructor(baseUrl: string, adminPassword?: string) {
    this.tap = new Tap(baseUrl, { adminPassword });
  }

  public async ensureRepoTracked(did: string) {
    if (this.trackedRepos.has(did)) {
      return;
    }

    await this.tap.addRepos([did]);
    this.trackedRepos.add(did);
  }
}

export class TapFirehoseSubscriber {
  private readonly tap: Tap;
  private channel: TapChannel | null = null;

  constructor(tapUrl: string, historyStore: TapLexiconHistoryStore, adminPassword?: string) {
    this.tap = new Tap(tapUrl, { adminPassword });

    const indexer = new SimpleIndexer();
    indexer.record(async (event) => {
      historyStore.ingestFromRecordEvent(event);
    });
    indexer.error((error) => {
      console.error("Tap channel error", error);
    });

    this.channel = this.tap.channel(indexer);
  }

  public start() {
    if (!this.channel) {
      return;
    }

    this.channel.start().catch((error: unknown) => {
      console.error("Tap channel stopped", error);
    });
  }

  public async stop() {
    if (!this.channel) {
      return;
    }

    await this.channel.destroy();
    this.channel = null;
  }
}

function isLexiconRecordEvent(
  event: RecordEvent,
): event is RecordEvent & { record: { id: string; revision?: number; lexicon: 1; defs: object } } {
  return (
    event.collection === LEXICON_COLLECTION &&
    (event.action === "create" || event.action === "update") &&
    isLexiconRecord(event.record)
  );
}

function isLexiconRecord(
  value: unknown,
): value is { id: string; revision?: number; lexicon: 1; defs: object } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as {
    id?: unknown;
    revision?: unknown;
    lexicon?: unknown;
    defs?: unknown;
  };

  return (
    typeof record.id === "string" &&
    (record.revision === undefined || typeof record.revision === "number") &&
    record.lexicon === 1 &&
    typeof record.defs === "object" &&
    record.defs !== null
  );
}
