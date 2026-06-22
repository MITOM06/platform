import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import {
  McpDirectoryEntry,
  McpDirectoryEntrySchema,
} from '../connections/schemas/mcp-directory-entry.schema';
import { DirectoryService } from './directory.service';
import { DirectoryController } from './directory.controller';

const mongoFeature = MongooseModule.forFeature([
  { name: McpDirectoryEntry.name, schema: McpDirectoryEntrySchema },
]);

@Module({
  imports: [mongoFeature, AuditModule],
  controllers: [DirectoryController],
  providers: [DirectoryService],
  exports: [DirectoryService, mongoFeature],
})
export class DirectoryModule {}
