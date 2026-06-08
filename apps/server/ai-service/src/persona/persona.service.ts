import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiPersona } from './ai-persona.schema';

export interface UpsertPersonaDto {
  name?: string;
  avatarUrl?: string | null;
  tone?: string;
  systemPromptPrefix?: string | null;
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  friendly: 'Be warm, empathetic, and approachable.',
  professional: 'Be precise, formal, and thorough.',
  concise: 'Be direct and brief. Avoid unnecessary words.',
  creative: 'Be imaginative, use vivid language, and think outside the box.',
};

export const VALID_TONES = ['friendly', 'professional', 'concise', 'creative'] as const;

@Injectable()
export class PersonaService {
  constructor(
    @InjectModel(AiPersona.name) private readonly personaModel: Model<AiPersona>,
  ) {}

  async getPersona(conversationId: string): Promise<AiPersona | null> {
    return this.personaModel.findOne({ conversationId }).exec();
  }

  async upsertPersona(
    conversationId: string,
    dto: UpsertPersonaDto,
    userId: string,
  ): Promise<AiPersona> {
    const update: Record<string, unknown> = { createdBy: userId, updatedAt: new Date() };
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.avatarUrl !== undefined) update.avatarUrl = dto.avatarUrl;
    if (dto.tone !== undefined) update.tone = dto.tone;
    if (dto.systemPromptPrefix !== undefined) {
      update.systemPromptPrefix = dto.systemPromptPrefix
        ? dto.systemPromptPrefix.slice(0, 500)
        : null;
    }
    return this.personaModel
      .findOneAndUpdate({ conversationId }, { $set: update }, { upsert: true, new: true })
      .exec() as Promise<AiPersona>;
  }

  async deletePersona(conversationId: string): Promise<void> {
    await this.personaModel.deleteOne({ conversationId }).exec();
  }

  buildSystemPrompt(persona: AiPersona | null, displayName: string): string {
    const name = persona?.name ?? 'PON AI';
    const tone = persona?.tone ?? 'friendly';
    const prefix = persona?.systemPromptPrefix ?? null;
    const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.friendly;

    let prompt =
      `You are ${name}, an intelligent AI assistant in the PON chat platform.\n` +
      `You are helping ${displayName}.\n` +
      `${toneInstruction}\n` +
      `Respond in the same language the user writes in.\n` +
      `If you don't know something, say so clearly.`;

    if (prefix) {
      prompt = `${prefix}\n\n${prompt}`;
    }

    return prompt;
  }
}
