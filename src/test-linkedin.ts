import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { LinkedInService } from "./modules/linkedin/linkedin.service";

/**
 * Quick LinkedIn credential test — bypasses Claude entirely.
 * Run with: npm run test:linkedin
 */
async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  const linkedin = app.get(LinkedInService);

  const testPost = `🔍 Industry Insight — March 10, 2026

77% of hotel guests now prefer automated messaging over calling the front desk — yet most hospitality businesses still run on legacy systems that can't deliver it.

According to a 2026 report by Canary Technologies, 67% of guests already use AI to plan their travel, and smart room technology is on track to reach 82% of households this year. The gap between guest expectations and hotel operations has never been wider.

What this means for your business:
• Guests are arriving with digital-first expectations — your software either meets them or loses them
• Hotels using contactless and AI-driven platforms are pulling ahead on occupancy and satisfaction scores
• The window to modernise before this becomes table stakes is closing fast

The businesses that moved early on this are already seeing the gap widen in their favour. What's the one operational bottleneck costing you the most right now?

Source: https://webflow.canarytechnologies.com/post/hospitality-technology-trends-for-2026

#HospitalityTech #SoftwareArchitecture #DigitalTransformation`;

  try {
    const result = await linkedin.createPost(testPost);
    if (result.success) {
      console.log(`\n✓ LinkedIn post published! ID: ${result.postId}`);
      console.log("Your LinkedIn credentials are working correctly.");
    } else {
      console.log(`\n✗ Failed: ${result.error}`);
    }
  } finally {
    await app.close();
  }
}

run();
