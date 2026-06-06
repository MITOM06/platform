import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KbDocument, KbDocumentSchema } from './kb-document.schema';
import { DocumentExtractorService } from './document-extractor.service';
import { TextChunkerService } from './text-chunker.service';
import { EmbeddingService } from './embedding.service';
import { VectorStoreService } from './vector-store.service';
import { KbProcessorService } from './kb-processor.service';
import { RedisModule } from '../redis/redis.module';

const kbFeature = MongooseModule.forFeature([
  { name: KbDocument.name, schema: KbDocumentSchema },
]) as unknown as DynamicModule;

@Module({
  imports: [kbFeature, RedisModule],
  providers: [
    DocumentExtractorService,
    TextChunkerService,
    EmbeddingService,
    VectorStoreService,
    KbProcessorService,
  ],
  exports: [KbProcessorService, VectorStoreService, EmbeddingService],
})
export class KbModule {}
