import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import appConfig from "./config/app.config";
import { configValidationSchema } from "./config/config.validation";
import { AppLoggerModule } from "./logger/logger.module";

/**
 * CoreModule is @Global — providers registered here are available app-wide
 * without needing to re-import. Only singleton, infrastructure-level concerns
 * belong here (config, logger, http client).
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: configValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 3,
    }),
    AppLoggerModule,
  ],
  exports: [HttpModule, AppLoggerModule],
})
export class CoreModule {}
