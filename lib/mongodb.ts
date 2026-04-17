import mongoose from "mongoose";

const MONGODB_URL = process.env.MONGODB_URL!;

if (!MONGODB_URL) throw new Error("MONGODB_URL not set in .env.local");

let cached = (global as any).__mongoCache as {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

if (!cached) {
  cached = (global as any).__mongoCache = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URL, { dbName: "voicegen" });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
