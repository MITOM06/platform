import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiPersona, AiPersonaSchema } from './ai-persona.schema';
import { PersonaService } from './persona.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AiPersona.name, schema: AiPersonaSchema }]),
  ],
  providers: [PersonaService],
  exports: [PersonaService],
})
export class PersonaModule {}
