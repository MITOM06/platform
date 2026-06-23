import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PersonaService } from './persona.service';
import { AiPersona } from './ai-persona.schema';

const mockPersonaModel = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
};

describe('PersonaService', () => {
  let service: PersonaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonaService,
        { provide: getModelToken(AiPersona.name), useValue: mockPersonaModel },
      ],
    }).compile();

    service = module.get<PersonaService>(PersonaService);
    jest.clearAllMocks();
  });

  describe('buildSystemPrompt', () => {
    it('uses default name and friendly tone when persona is null', () => {
      const prompt = service.buildSystemPrompt(null, 'Alice');
      expect(prompt).toContain('PON AI');
      expect(prompt).toContain('Alice');
      expect(prompt).toContain('warm, empathetic');
    });

    it('uses professional tone instruction', () => {
      const persona = { name: 'DevBot', tone: 'professional', systemPromptPrefix: null } as AiPersona;
      const prompt = service.buildSystemPrompt(persona, 'Bob');
      expect(prompt).toContain('DevBot');
      expect(prompt).toContain('precise, formal');
    });

    it('uses concise tone instruction', () => {
      const persona = { name: 'PON AI', tone: 'concise', systemPromptPrefix: null } as AiPersona;
      const prompt = service.buildSystemPrompt(persona, 'Bob');
      expect(prompt).toContain('direct and brief');
    });

    it('uses creative tone instruction', () => {
      const persona = { name: 'PON AI', tone: 'creative', systemPromptPrefix: null } as AiPersona;
      const prompt = service.buildSystemPrompt(persona, 'Bob');
      expect(prompt).toContain('imaginative');
    });

    it('prepends systemPromptPrefix before base prompt', () => {
      const persona = {
        name: 'PON AI',
        tone: 'friendly',
        systemPromptPrefix: 'Always respond with bullet points.',
      } as AiPersona;
      const prompt = service.buildSystemPrompt(persona, 'Alice');
      expect(prompt.startsWith('Always respond with bullet points.')).toBe(true);
      expect(prompt).toContain('PON AI');
    });

    it('falls back to friendly when tone is unknown', () => {
      const persona = { name: 'PON AI', tone: 'unknown_tone', systemPromptPrefix: null } as AiPersona;
      const prompt = service.buildSystemPrompt(persona, 'Alice');
      expect(prompt).toContain('warm, empathetic');
    });

    // ── Workspace defaults (TASK-12) ─────────────────────────────────────────

    it('uses workspace default name/tone when persona is null', () => {
      const prompt = service.buildSystemPrompt(null, 'Alice', {
        personaName: 'Acme Bot',
        defaultTone: 'professional',
      });
      expect(prompt).toContain('Acme Bot');
      expect(prompt).toContain('precise, formal');
    });

    it('per-conversation persona overrides the workspace default (highest precedence)', () => {
      const persona = { name: 'DevBot', tone: 'creative', systemPromptPrefix: null } as AiPersona;
      const prompt = service.buildSystemPrompt(persona, 'Bob', {
        personaName: 'Acme Bot',
        defaultTone: 'professional',
      });
      expect(prompt).toContain('DevBot');
      expect(prompt).toContain('imaginative');
      expect(prompt).not.toContain('Acme Bot');
    });

    it('falls back to hardcoded PON AI/friendly when both persona and workspace default are null', () => {
      const prompt = service.buildSystemPrompt(null, 'Alice', {
        personaName: null,
        defaultTone: null,
      });
      expect(prompt).toContain('PON AI');
      expect(prompt).toContain('warm, empathetic');
    });
  });

  describe('getPersona', () => {
    it('returns persona when found', async () => {
      const fakePersona = { conversationId: 'conv-1', name: 'DevBot' } as AiPersona;
      mockPersonaModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(fakePersona) });
      const result = await service.getPersona('conv-1');
      expect(result).toEqual(fakePersona);
    });

    it('returns null when not found', async () => {
      mockPersonaModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      const result = await service.getPersona('conv-none');
      expect(result).toBeNull();
    });
  });

  describe('upsertPersona', () => {
    it('calls findOneAndUpdate with upsert', async () => {
      const saved = { conversationId: 'conv-1', name: 'DevBot' } as AiPersona;
      mockPersonaModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(saved) });
      const result = await service.upsertPersona('conv-1', { name: 'DevBot', tone: 'professional' }, 'user-1');
      expect(result).toEqual(saved);
      expect(mockPersonaModel.findOneAndUpdate).toHaveBeenCalledWith(
        { conversationId: 'conv-1' },
        expect.objectContaining({ $set: expect.objectContaining({ name: 'DevBot' }) }),
        { upsert: true, new: true },
      );
    });

    it('truncates systemPromptPrefix to 500 chars', async () => {
      const longPrefix = 'A'.repeat(600);
      const saved = { conversationId: 'conv-1' } as AiPersona;
      mockPersonaModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(saved) });
      await service.upsertPersona('conv-1', { systemPromptPrefix: longPrefix }, 'user-1');
      const call = mockPersonaModel.findOneAndUpdate.mock.calls[0];
      expect(call[1].$set.systemPromptPrefix).toHaveLength(500);
    });
  });

  describe('deletePersona', () => {
    it('calls deleteOne', async () => {
      mockPersonaModel.deleteOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
      await service.deletePersona('conv-1');
      expect(mockPersonaModel.deleteOne).toHaveBeenCalledWith({ conversationId: 'conv-1' });
    });
  });
});
