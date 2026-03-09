import { Module } from "@nestjs/common";
import { SchedulerService } from "./scheduler.service";
import { ClaudeModule } from "../claude/claude.module";
import { LinkedInModule } from "../linkedin/linkedin.module";
import { TwitterModule } from "../twitter/twitter.module";
import { NewsModule } from "../news/news.module";

@Module({
  imports: [NewsModule, ClaudeModule, LinkedInModule, TwitterModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
