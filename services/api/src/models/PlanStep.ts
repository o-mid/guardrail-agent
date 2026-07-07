import { Schema, model, type InferSchemaType, Types } from "mongoose";

const planStepSchema = new Schema(
  {
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    index: { type: Number, required: true },
    action: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    decodedSummary: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "dry_running", "submitting", "succeeded", "failed", "cancelled"],
      default: "pending",
    },
    dryRunOk: { type: Boolean, default: null },
    txHash: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

planStepSchema.index({ planId: 1, index: 1 }, { unique: true });

export type PlanStepDoc = InferSchemaType<typeof planStepSchema> & { _id: Types.ObjectId };
export const PlanStep = model("PlanStep", planStepSchema);
