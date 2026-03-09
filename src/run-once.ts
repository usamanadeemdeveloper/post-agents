import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { SchedulerService } from "./modules/scheduler/scheduler.service";

/**
 * Standalone entry point — no HTTP server, no persistent process.
 * Boots the NestJS DI container, runs the daily post pipeline once, then exits.
 * Called by GitHub Actions on a cron schedule.
 */
async function run() {
  // createApplicationContext = full DI, no HTTP listener
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  const scheduler = app.get(SchedulerService);

  try {
    const result = await scheduler.triggerManually();

    const li = result.linkedinResult;
    const tw = result.twitterResult;

    console.log("\n=== Run complete ===");
    console.log(
      `LinkedIn : ${li.success ? `✓ post ID ${li.postId}` : `✗ ${li.error}`}`,
    );
    console.log(
      `Twitter  : ${tw.success ? `✓ post ID ${tw.postId}` : `✗ ${tw.error}`}`,
    );

    // Exit 1 if both platforms failed so GitHub Actions marks the run as failed
    if (!li.success && !tw.success) {
      process.exit(1);
    }
  } finally {
    await app.close();
  }
}

run();
