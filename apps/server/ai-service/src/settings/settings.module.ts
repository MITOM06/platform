import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workspace, WorkspaceSchema } from './workspace.schema';
import { RedisModule } from '../redis/redis.module';
import { SettingsService } from './settings.service';
import { SettingsInvalidatorService } from './settings-invalidator.service';

/**
 * Read-only workspace AI settings (TASK-12). Holds a read-only Mongoose model on
 * the shared `workspaces` collection, the cached resolver, and the Redis
 * pub/sub invalidator. Exports SettingsService for the AI read paths.
 */
@Module({
  imports: [
    RedisModule,
    MongooseModule.forFeature([{ name: Workspace.name, schema: WorkspaceSchema }]),
  ],
  providers: [SettingsService, SettingsInvalidatorService],
  exports: [SettingsService],
})
export class SettingsModule {}
