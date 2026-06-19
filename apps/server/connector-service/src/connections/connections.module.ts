import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  UserConnection,
  UserConnectionSchema,
} from './schemas/user-connection.schema';
import {
  CustomMcpServer,
  CustomMcpServerSchema,
} from './schemas/custom-mcp-server.schema';
import { UserSkill, UserSkillSchema } from './schemas/user-skill.schema';

const mongoFeature = MongooseModule.forFeature([
  { name: UserConnection.name, schema: UserConnectionSchema },
  { name: CustomMcpServer.name, schema: CustomMcpServerSchema },
  { name: UserSkill.name, schema: UserSkillSchema },
]);

@Module({
  imports: [mongoFeature],
  exports: [mongoFeature],
})
export class ConnectionsModule {}
