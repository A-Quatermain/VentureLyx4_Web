import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function PaymentResult({ status }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState(status === "cancel" ? "cancelled" : "checking");
  const sessionId = params.get("session_id");

  useEffect(() => {
    if (status === "cancel" || !sessionId) return;
    let tries = 0;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") { setState("paid"); return; }
        if (["expired", "failed"].includes(data.payment_status)) { setState("failed"); return; }
      } catch {}
      if (tries++ < 8) setTimeout(poll, 2000);
      else setState("pending");
    };
    poll();
  }, [sessionId, status]);

  const icon = state === "paid" ? <CheckCircle2 className="h-14 w-14 text-emerald-500" />
    : state === "checking" ? <Loader2 className="h-14 w-14 text-primary animate-spin" />
    : <XCircle className="h-14 w-14 text-red-500" />;

  const title = { paid: "Payment received", checking: "Confirming payment…", cancelled: "Payment cancelled",
    failed: "Payment failed", pending: "Still processing" }[state];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grid-noise p-6">
      <div className="bg-card border border-white/10 rounded-md p-10 text-center max-w-md w-full" data-testid="payment-result">
        <div className="flex justify-center mb-4">{icon}</div>
        <h1 className="font-heading font-extrabold text-2xl tracking-tight mb-2">{title}</h1>
        <p className="text-muted-foreground text-sm mb-6">
          {state === "paid" ? "The invoice has been marked as paid in your command center." : "You can return to your invoices and try again."}
        </p>
        <Button onClick={() => navigate("/operate")} className="rounded-sm bg-primary text-black hover:bg-primary/90" data-testid="payment-back">
          Back to Operate
        </Button>
      </div>
    </div>
  );
}
