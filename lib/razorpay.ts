"use client";

import { useEffect, useState } from "react";

/** Waits for Razorpay SDK to be available on window */
export function useRazorpay() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Already loaded
        if (typeof window !== "undefined" && window.Razorpay) {
            setReady(true);
            return;
        }

        // Poll until the SDK is injected (it's loaded via <Script> in layout)
        const timer = setInterval(() => {
            if (typeof window !== "undefined" && window.Razorpay) {
                setReady(true);
                clearInterval(timer);
            }
        }, 200);

        return () => clearInterval(timer);
    }, []);

    return ready;
}

interface RazorpayOptions {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    name: string;
    description: string;
    email: string;
    isRenewal?: boolean;
    onSuccess: (data: { planExpiresAt: string }) => void;
    onFailure: (reason: string) => void;
    onDismiss?: () => void;
}

/** Opens the Razorpay checkout modal */
export function openRazorpayCheckout(opts: RazorpayOptions) {
    if (!window.Razorpay) {
        throw new Error("Razorpay SDK not loaded. Please refresh and try again.");
    }

    const options = {
        key: opts.keyId,
        amount: opts.amount,
        currency: opts.currency,
        name: opts.name,
        description: opts.description,
        order_id: opts.orderId,
        image: "/favicon.ico",
        handler: async function (response: any) {
            try {
                const verifyRes = await fetch("/api/payment/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                    }),
                });
                const vData = await verifyRes.json();
                if (verifyRes.ok) {
                    opts.onSuccess({ planExpiresAt: vData.planExpiresAt });
                } else {
                    opts.onFailure(vData.error || "Payment verification failed.");
                }
            } catch (e: any) {
                opts.onFailure(e.message || "Verification error.");
            }
        },
        prefill: { email: opts.email },
        theme: { color: "#4f46e5" },
        modal: {
            ondismiss: () => opts.onDismiss?.(),
        },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", function (response: any) {
        opts.onFailure(response?.error?.description || "Payment failed. Please try again.");
    });
    rzp.open();
}
