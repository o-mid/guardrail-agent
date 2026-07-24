import { Schema, model, type InferSchemaType, Types } from "mongoose";

const siweNonceSchema = new Schema(
  {
    nonce: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

siweNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SiweNonceDoc = InferSchemaType<typeof siweNonceSchema> & { _id: Types.ObjectId };
export const SiweNonce = model("SiweNonce", siweNonceSchema);
