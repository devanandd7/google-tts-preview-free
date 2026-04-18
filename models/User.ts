import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPaymentRecord {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  currency: string;
  paidAt: Date;
  planActivatedAt: Date;
  planExpiresAt: Date;
}

export interface IUser extends Document {
  clerkId: string;
  email: string;
  plan: "free" | "pro";
  planStatus: "active" | "expired" | "none";

  // ── All-time usage totals ────────────────────────────────────────────────────
  directTtsCount: number;   // direct script → audio
  aiScriptCount: number;    // AI script builder → audio
  broadcastCount: number;   // broadcast sessions
  imageCount: number;       // image generations
  musicCount: number;       // music generations

  // ── Daily usage counters (auto-reset each UTC day) ───────────────────────────
  dailyDirectTtsCount: number;
  dailyAiScriptCount: number;
  dailyBroadcastCount: number;
  dailyImageCount: number;
  dailyUsageDate: Date | null; // UTC date when daily counters were last reset

  // ── Pro specific ─────────────────────────────────────────────────────────────
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  ownApiKey?: string;          // Pro: user's own Gemini API key (encrypted)
  planActivatedAt?: Date;
  planExpiresAt?: Date;        // 30 days after planActivatedAt
  paymentHistory: IPaymentRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const PaymentRecordSchema = new Schema<IPaymentRecord>(
  {
    razorpayOrderId:   { type: String, required: true },
    razorpayPaymentId: { type: String, required: true },
    amountPaise:       { type: Number, required: true },
    currency:          { type: String, default: "INR" },
    paidAt:            { type: Date, required: true },
    planActivatedAt:   { type: Date, required: true },
    planExpiresAt:     { type: Date, required: true },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    clerkId:           { type: String, required: true, unique: true },
    email:             { type: String, required: false },
    plan:              { type: String, enum: ["free", "pro"], default: "free" },
    planStatus:        { type: String, enum: ["active", "expired", "none"], default: "none" },

    // All-time totals
    directTtsCount:    { type: Number, default: 0 },
    aiScriptCount:     { type: Number, default: 0 },
    broadcastCount:    { type: Number, default: 0 },
    imageCount:        { type: Number, default: 0 },
    musicCount:        { type: Number, default: 0 },

    // Daily counters
    dailyDirectTtsCount:  { type: Number, default: 0 },
    dailyAiScriptCount:   { type: Number, default: 0 },
    dailyBroadcastCount:  { type: Number, default: 0 },
    dailyImageCount:      { type: Number, default: 0 },
    dailyUsageDate:       { type: Date, default: null },

    razorpayOrderId:   { type: String },
    razorpayPaymentId: { type: String },
    ownApiKey:         { type: String },
    planActivatedAt:   { type: Date },
    planExpiresAt:     { type: Date },
    paymentHistory:    { type: [PaymentRecordSchema], default: [] },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
