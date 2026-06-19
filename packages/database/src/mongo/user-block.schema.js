"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserBlockSchema = exports.UserBlock = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let UserBlock = class UserBlock {
};
exports.UserBlock = UserBlock;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], UserBlock.prototype, "blockerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], UserBlock.prototype, "blockedId", void 0);
exports.UserBlock = UserBlock = __decorate([
    (0, mongoose_1.Schema)({ timestamps: { createdAt: true, updatedAt: false } })
], UserBlock);
exports.UserBlockSchema = mongoose_1.SchemaFactory.createForClass(UserBlock);
exports.UserBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
exports.UserBlockSchema.index({ blockedId: 1 });
//# sourceMappingURL=user-block.schema.js.map