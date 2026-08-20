import "@/App.css";
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";

import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import AppLayout from "@/components/layout/AppLayout";
import CommandCenter from "@/pages/CommandCenter";
import Operate from "@/pages/Operate";
import ScaleSEO from "@/pages/ScaleSEO";
import Reviews from "@/pages/Reviews";
import Settings from "@/pages/Settings";
import PaymentResult from "@/pages/PaymentResult";

function FullLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function Protected({ children }) {
  const { user, business } = useAuth();
  const location = useLocation();
  if (user === undefined) return <FullLoader />;
  if (user === null) return <Navigate to="/login" replace />;
  if (!business && location.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <FullLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Auth mode="login" /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Auth mode="register" /></PublicOnly>} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route path="/payment/success" element={<PaymentResult status="success" />} />
      <Route path="/payment/cancel" element={<PaymentResult status="cancel" />} />

      <Route element={<Protected><AppLayout /></Protected>}>
        <Route path="/" element={<CommandCenter />} />
        <Route path="/operate" element={<Operate />} />
        <Route path="/scaleseo" element={<ScaleSEO />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster position="top-right" theme="dark" />
      </AuthProvider>
    </div>
  );
}
