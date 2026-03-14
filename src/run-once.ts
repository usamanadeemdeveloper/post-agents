import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
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
  const config = app.get(ConfigService);

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

    // By default we soft-fail publish errors so the agent run still completes.
    const failOnPublishFailure =
      config.get<boolean>("app.scheduler.failOnPublishFailure") ?? false;
    if (!li.success && !tw.success) {
      console.warn(
        failOnPublishFailure
          ? "Both platforms failed and strict failure is enabled."
          : "Both platforms failed, but strict failure is disabled.",
      );
      if (failOnPublishFailure) {
        process.exit(1);
      }
    }
  } finally {
    await app.close();
  }
}

run();
