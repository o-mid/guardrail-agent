import { Schema, model, type InferSchemaType, Types } from "mongoose";

const auditEventSchema = new Schema(
  {
    type: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditEventSchema.index({ entityId: 1, createdAt: -1 });

export type AuditEventDoc = InferSchemaType<typeof auditEventSchema> & { _id: Types.ObjectId };
export const AuditEvent = model("AuditEvent", auditEventSchema);
