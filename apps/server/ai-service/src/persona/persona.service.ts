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

/** Workspace-level persona defaults (TASK-12). Each null ⇒ no workspace override. */
export interface PersonaDefaults {
  personaName?: string | null;
  defaultTone?: string | null;
}

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

  /**
   * Builds the STABLE, cacheable system prompt: persona + tone + grounding
   * contract. Contains nothing volatile (no RAG chunks, no retrieved memory
   * facts) so it can be marked `cache_control: ephemeral` and reused across
   * turns of the same conversation.
   */
  buildSystemPrompt(
    persona: AiPersona | null,
    displayName: string,
    defaults?: PersonaDefaults,
  ): string {
    // Precedence: per-conversation persona (highest) → workspace default → hardcoded.
    const name = persona?.name ?? defaults?.personaName ?? 'PON AI';
    const tone = persona?.tone ?? defaults?.defaultTone ?? 'friendly';
    const prefix = persona?.systemPromptPrefix ?? null;
    const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.friendly;

    let prompt =
      `You are ${name}, an intelligent AI assistant in the PON chat platform.\n` +
      `You are helping ${displayName}.\n` +
      `${toneInstruction}\n` +
      `Respond in the same language the user writes in.\n\n` +
      this.groundingContract();

    if (prefix) {
      prompt = `${prefix}\n\n${prompt}`;
    }

    return prompt;
  }

  /**
   * Anti-hallucination grounding contract. Kept here (stable text) so it stays
   * inside the cached system block.
   */
  private groundingContract(): string {
    return (
      `## Grounding & Honesty Rules (follow strictly)\n` +
      `- Answer ONLY from: (a) the conversation so far, (b) any "Knowledge Base Context" provided in this turn, and (c) facts listed under "Relevant memory about this user".\n` +
      `- If the Knowledge Base Context is empty, marked "no relevant context", or does not cover the question, say so plainly (e.g. "I don't have anything on that in the uploaded documents") instead of inventing an answer.\n` +
      `- NEVER fabricate dates, numbers, names, quotes, URLs, or citations. If you are unsure, say you are unsure.\n` +
      `- Distinguish a stored memory fact (something the user previously told you) from your own inference. Do not present a guess as a remembered fact.\n` +
      `- When you use a Knowledge Base chunk, cite it inline as [Source N] matching the provided source number.\n` +
      `- Prefer "I don't know" over a confident-sounding but unverified claim.`
    );
  }
}
