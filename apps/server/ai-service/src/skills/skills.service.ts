import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserSkill, UserSkillDocument } from './user-skill.schema';
import { buildSkillInstructions } from './skill-catalog';

/**
 * Resolves a user's enabled skills into a system-prompt instruction block.
 * Reads the shared `user_skills` collection directly (no connector-service
 * dependency). Fails soft: any error → no skill instructions (the assistant
 * still works, just without skill personalization).
 */
@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

  constructor(
    @InjectModel(UserSkill.name) private readonly skillModel: Model<UserSkillDocument>,
  ) {}

  async getEnabledSkillInstructions(userId: string): Promise<string> {
    try {
      const docs = await this.skillModel
        .find({ userId, enabled: true })
        .select('skillId')
        .lean()
        .exec();
      return buildSkillInstructions(docs.map((d) => d.skillId));
    } catch (err) {
      this.logger.warn(`Skill lookup failed for ${userId}: ${(err as Error).message}`);
      return '';
    }
  }
}
