import { Schema, model, type InferSchemaType, Types } from "mongoose";

const policySchema = new Schema(
  {
    scope: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    rules: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

policySchema.index({ scope: 1, version: -1 });

export type PolicyDoc = InferSchemaType<typeof policySchema> & { _id: Types.ObjectId };
export const Policy = model("Policy", policySchema);
