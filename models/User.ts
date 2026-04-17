import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  clerkId: string;
  email: string;
  plan: "free" | "pro";
  // Usage counters
  directTtsCount: number;
  aiScriptCount: number;
  // Pro specific
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  ownApiKey?: string;          // Pro: user's own Gemini API key
  planActivatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    clerkId:           { type: String, required: true, unique: true },
    email:             { type: String, required: false },
    plan:              { type: String, enum: ["free", "pro"], default: "free" },
    directTtsCount:    { type: Number, default: 0 },
    aiScriptCount:     { type: Number, default: 0 },
    razorpayOrderId:   { type: String },
    razorpayPaymentId: { type: String },
    ownApiKey:         { type: String },
    planActivatedAt:   { type: Date },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
