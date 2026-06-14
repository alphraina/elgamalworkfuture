import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/auth.js";
import { startScheduler } from "./lib/scheduler.js";
import { trackError } from "./lib/error-tracker.js";

// ── Capture unhandled promise rejections and exceptions ──────────────────────
process.on("unhandledRejection", (reason: any) => {
  trackError({
    errorType: "UnhandledRejection",
    errorMessage: String(reason?.message ?? reason ?? "Unknown rejection"),
    stackTrace: reason?.stack,
  });
});

process.on("uncaughtException", (err: Error) => {
  trackError({
    errorType: "UncaughtException",
    errorMessage: err.message,
    stackTrace: err.stack,
  });
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdminUser() {
  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
    if (existing.length === 0) {
      await db.insert(usersTable).values({
        username: "admin",
        fullName: "System Administrator",
        passwordHash: hashPassword("alphraina"),
        role: "admin",
        isActive: true,
      });
      logger.info("Admin user created (first-time seed)");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}

app.listen(port, async () => {
  logger.info({ port }, "Server listening");
  await seedAdminUser();
  startScheduler();
});
