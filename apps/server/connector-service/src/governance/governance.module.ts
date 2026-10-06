import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Role,
  RoleSchema,
  User,
  UserSchema,
  Workspace,
  WorkspaceSchema,
} from '@platform/database';
import {
  McpDirectoryEntry,
  McpDirectoryEntrySchema,
} from '../connections/schemas/mcp-directory-entry.schema';
import { UserSkill, UserSkillSchema } from '../connections/schemas/user-skill.schema';
import { PermResolverService } from '../internal/perm-resolver.service';
import { ConnectorPolicyService } from './connector-policy.service';

/**
 * Live governance reads shared by every surface that acts for a member:
 * capability/status resolution (users/roles) and connector policy
 * (workspace allow-list, AI allowedConnectors, directory availability, skills).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: McpDirectoryEntry.name, schema: McpDirectoryEntrySchema },
      { name: UserSkill.name, schema: UserSkillSchema },
    ]),
  ],
  providers: [PermResolverService, ConnectorPolicyService],
  exports: [PermResolverService, ConnectorPolicyService],
})
export class GovernanceModule {}
