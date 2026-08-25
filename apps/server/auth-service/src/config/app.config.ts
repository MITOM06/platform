import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,

  // Dev default only — main.ts refuses to boot in production without the env
  // var. ':8081' was the retired Expo port; the web dev server is :3000.
  webRedirectUrl:
    process.env.WEB_REDIRECT_URL || 'http://localhost:3000/oauth-callback',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES,
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES,

  // Enterprise bootstrap (single-workspace-per-deployment).
  workspaceName: process.env.WORKSPACE_NAME || 'PON Workspace',
  bootstrapOwnerEmail: process.env.BOOTSTRAP_OWNER_EMAIL,
}));
