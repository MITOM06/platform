"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseRedisModule = exports.REDIS_CLIENT = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
exports.REDIS_CLIENT = 'REDIS_CLIENT';
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
                    return new ioredis_1.default({
                        host: process.env.REDIS_HOST || 'localhost',
                        port: Number(process.env.REDIS_PORT) || 6379,
                        password: process.env.REDIS_PASSWORD,
                    });
                },
            },
        ],
        exports: [exports.REDIS_CLIENT],
    })
], DatabaseRedisModule);
//# sourceMappingURL=redis.module.js.map