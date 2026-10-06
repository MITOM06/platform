import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { USER_ID_PATTERN } from '../internal/internal.controller';

/** `extbot:<factoryBotId>` — the synthetic chat participant id of a Bot Factory bot. */
export const BOT_USER_ID_PATTERN = /^[A-Za-z0-9:._-]{1,128}$/;

/**
 * Body of the issue/revoke endpoints (admin JWT and internal-key variants).
 * Without validators the global `ValidationPipe({ whitelist: true })` stripped
 * every field, so admin issue/revoke ran with `undefined` ids.
 */
export class BotSessionDto {
  @IsString()
  @Matches(USER_ID_PATTERN, { message: 'userId must be a plain id' })
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(BOT_USER_ID_PATTERN, { message: 'botUserId is malformed' })
  botUserId: string;
}

export class BotSessionListQueryDto {
  @IsString()
  @Matches(USER_ID_PATTERN, { message: 'userId must be a plain id' })
  userId: string;
}
