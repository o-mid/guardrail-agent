import { Schema, model, type InferSchemaType, Types } from "mongoose";

const planSchema = new Schema(
  {
    intentId: { type: Schema.Types.ObjectId, ref: "Intent", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    schemaVersion: { type: String, required: true },
    chain: { type: String, required: true },
    summary: { type: String, required: true },
    status: {
      type: String,
      enum: ["awaiting_approval", "executing", "completed", "failed", "cancelled", "rejected_schema", "rejected_policy"],
      required: true,
      index: true,
    },
    rawModelJson: { type: Schema.Types.Mixed, required: true },
    rejectionReasons: { type: [String], default: [] },
    policyVersion: { type: Number, required: true },
  },
  { timestamps: true },
);

export type PlanDoc = InferSchemaType<typeof planSchema> & { _id: Types.ObjectId };
export const Plan = model("Plan", planSchema);
