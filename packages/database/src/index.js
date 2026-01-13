"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDIS_CLIENT = exports.Redis = void 0;
__exportStar(require("./mongo/mongo.module"), exports);
__exportStar(require("./redis/redis.module"), exports);
var ioredis_1 = require("ioredis");
Object.defineProperty(exports, "Redis", { enumerable: true, get: function () { return ioredis_1.Redis; } });
var redis_module_1 = require("./redis/redis.module");
Object.defineProperty(exports, "REDIS_CLIENT", { enumerable: true, get: function () { return redis_module_1.REDIS_CLIENT; } });
//# sourceMappingURL=index.js.map