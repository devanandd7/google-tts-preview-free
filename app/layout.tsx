import type { Metadata } from "next";
import { Epilogue, Space_Grotesk, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "./components/Toaster";
import Script from "next/script";
import "./globals.css";

const epilogue = Epilogue({
  variable: "--font-epilogue",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GenBox – Powered by Gemini",
  description: "Transform text into expressive AI voices. Free, powered by Gemini 3.1 Flash TTS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${epilogue.variable} ${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col">
          {/* Razorpay SDK — loaded globally so it is always ready before payment */}
          <Script
            id="razorpay-sdk"
            src="https://checkout.razorpay.com/v1/checkout.js"
            strategy="beforeInteractive"
          />
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
