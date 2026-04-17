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
  // Usage counters
  directTtsCount: number;
  aiScriptCount: number;
  // Pro specific
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  ownApiKey?: string;          // Pro: user's own Gemini API key
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
    directTtsCount:    { type: Number, default: 0 },
    aiScriptCount:     { type: Number, default: 0 },
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
