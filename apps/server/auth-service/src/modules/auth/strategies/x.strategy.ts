import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-twitter-oauth2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('X_CLIENT_ID'),
      clientSecret: configService.get<string>('X_CLIENT_SECRET'),
      callbackURL: configService.get<string>('X_CALLBACK_URL'),
      scope: ['users.read', 'tweet.read', 'offline.access'],
      pkce: true,
      state: true,
      authorizationURL: 'https://twitter.com/i/oauth2/authorize',
      tokenURL: 'https://api.twitter.com/2/oauth2/token',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: any, user: any) => void,
  ) {
    const { id, emails, displayName, photos, username } = profile;

    // X không guarantee trả email — có thể null
    const email = emails?.[0]?.value || null;

    const user = {
      id, // ✅ đổi từ twitterId → id, đồng bộ với Google/Facebook
      email, // ✅ có thể null
      displayName: displayName || username || 'User',
      avatar: photos?.[0]?.value || '',
    };

    done(null, user);
  }
}
