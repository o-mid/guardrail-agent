import { Schema, model, type InferSchemaType, Types } from "mongoose";

const intentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true },
    status: {
      type: String,
      enum: ["received", "planning", "planned", "rejected_schema", "rejected_policy", "planner_unavailable"],
      default: "received",
      index: true,
    },
    chainHint: { type: String, default: null },
    plannerLatencyMs: { type: Number, default: null },
    plannerModel: { type: String, default: null },
    usage: {
      type: new Schema(
        {
          promptTokens: { type: Number, required: true },
          completionTokens: { type: Number, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

intentSchema.index({ userId: 1, createdAt: -1 });

export type IntentDoc = InferSchemaType<typeof intentSchema> & { _id: Types.ObjectId };
export const Intent = model("Intent", intentSchema);
