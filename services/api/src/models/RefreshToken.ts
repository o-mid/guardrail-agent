import { Schema, model, type InferSchemaType, Types } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    jti: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema> & { _id: Types.ObjectId };
export const RefreshToken = model("RefreshToken", refreshTokenSchema);
