import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
   port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 3001,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES,
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES,
}));