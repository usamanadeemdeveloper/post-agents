import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { CoreModule } from "./core/core.module";
import { SchedulerModule } from "./modules/scheduler/scheduler.module";

@Module({
  imports: [
    // Core: config, logger — must be first
    CoreModule,

    // NestJS task scheduler — required for @Cron decorators
    ScheduleModule.forRoot(),

    // Feature modules
    SchedulerModule,
  ],
})
export class AppModule {}
