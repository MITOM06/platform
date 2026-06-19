"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseRedisModule = exports.REDIS_CLIENT = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
exports.REDIS_CLIENT = 'REDIS_CLIENT';
const logger = new common_1.Logger('DatabaseRedisModule');
let DatabaseRedisModule = class DatabaseRedisModule {
};
exports.DatabaseRedisModule = DatabaseRedisModule;
exports.DatabaseRedisModule = DatabaseRedisModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: exports.REDIS_CLIENT,
                useFactory: () => {
                    const failFastOptions = {
                        lazyConnect: true,
                        connectTimeout: 5000,
                        commandTimeout: 5000,
                        maxRetriesPerRequest: 1,
                        enableOfflineQueue: true,
                        retryStrategy: (times) => Math.min(times * 200, 2000),
                    };
                    const client = process.env.REDIS_URL
                        ? new ioredis_1.default(process.env.REDIS_URL, failFastOptions)
                        : new ioredis_1.default({
                            host: process.env.REDIS_HOST || 'localhost',
                            port: Number(process.env.REDIS_PORT) || 6379,
                            password: process.env.REDIS_PASSWORD,
                            ...failFastOptions,
                        });
                    client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
                    return client;
                },
            },
        ],
        exports: [exports.REDIS_CLIENT],
    })
], DatabaseRedisModule);
//# sourceMappingURL=redis.module.js.map