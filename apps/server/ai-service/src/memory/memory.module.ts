import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiMemory, AiMemorySchema } from './ai-memory.schema';
import { MemoryService } from './memory.service';

const memoryFeature = MongooseModule.forFeature([
  { name: AiMemory.name, schema: AiMemorySchema },
]) as unknown as DynamicModule;

@Module({
  imports: [memoryFeature],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
