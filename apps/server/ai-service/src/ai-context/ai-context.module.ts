import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AiContextEntry,
  AiContextEntrySchema,
  AiUserContext,
  AiUserContextSchema,
  Department,
  DepartmentSchema,
} from '@platform/database';
import { AiContextReaderService } from './ai-context-reader.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiUserContext.name, schema: AiUserContextSchema },
      { name: AiContextEntry.name, schema: AiContextEntrySchema },
      { name: Department.name, schema: DepartmentSchema },
    ]),
  ],
  providers: [AiContextReaderService],
  exports: [AiContextReaderService],
})
export class AiContextModule {}
