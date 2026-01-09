import { JwtService } from '@nestjs/jwt';

export function createWsAuthMiddleware(jwt: JwtService) {
  return (socket: any, next: (err?: any) => void) => {
    try {
      const token =
        socket.handshake?.auth?.token ||
        socket.handshake?.headers?.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('Missing token'));

      const secret = process.env.JWT_ACCESS_SECRET;
      if (!secret) return next(new Error('Missing JWT secret'));

      const payload = jwt.verify(token, { secret });
      socket.user = payload; // { sub, sid, iat, exp }
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  };
}
