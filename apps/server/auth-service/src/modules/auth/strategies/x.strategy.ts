import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-twitter-oauth2'; // Import từ thư viện OAuth2
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
    constructor(private configService: ConfigService) {
        super({
            // OAuth 2.0 dùng clientID và clientSecret
            clientID: configService.get<string>('X_CLIENT_ID'),
            clientSecret: configService.get<string>('X_CLIENT_SECRET'),
            callbackURL: configService.get<string>('X_CALLBACK_URL'),
            // Scope bắt buộc để lấy thông tin user và email
            // Lưu ý: Offline.access là để lấy Refresh Token
            scope: ['users.read', 'tweet.read', 'offline.access'],
            pkce: true, // X chuẩn 2 yêu cầu PKCE để bảo mật
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
        // Cấu trúc profile của X OAuth 2.0 hơi khác chuẩn cũ
        // Bạn nên console.log(profile) để xem cấu trúc chính xác nếu cần
        const { id, emails, displayName, photos, username } = profile;

        const user = {
            twitterId: id,
            email: emails?.[0]?.value || null, // X đôi khi không trả về email nếu user không cấp quyền
            displayName: displayName || username,
            avatar: photos?.[0]?.value || null,
        };

        done(null, user);
    }
}