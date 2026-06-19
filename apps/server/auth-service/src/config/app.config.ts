import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,

  webRedirectUrl: process.env.WEB_REDIRECT_URL || 'http://localhost:8081',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES,
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES,

  // Enterprise bootstrap (single-workspace-per-deployment).
  workspaceName: process.env.WORKSPACE_NAME || 'PON Workspace',
  bootstrapOwnerEmail: process.env.BOOTSTRAP_OWNER_EMAIL,
}));
