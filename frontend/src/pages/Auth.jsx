import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const HERO = "https://images.unsplash.com/photo-1758598497635-48cbbb1f6555?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxNzV8MHwxfHNlYXJjaHwzfHxzbWFsbCUyMGJ1c2luZXNzJTIwb3duZXIlMjBtb2Rlcm4lMjB3b3Jrc3BhY2V8ZW58MHx8fHwxNzg3MjA0NDExfDA&ixlib=rb-4.1.0&q=85";

export default function Auth({ mode = "login" }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = isLogin
      ? await login(form.email, form.password)
      : await register(form.name, form.email, form.password);
    setLoading(false);
    if (res.ok) {
      toast.success(isLogin ? "Welcome back." : "Account created.");
      navigate("/");
    } else {
      toast.error(res.error || "Something went wrong.");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden border-r border-white/10">
        <img src={HERO} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
        <div className="relative flex items-center gap-2">
          <div className="h-9 w-9 rounded-sm bg-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-heading font-extrabold text-xl tracking-tight">Venturelyx</span>
        </div>
        <div className="relative">
          <h2 className="font-heading font-extrabold text-4xl leading-tight tracking-tight max-w-md">
            We build businesses, <span className="text-primary">not websites.</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-md">
            One command center to launch, operate, get found and scale — with your own AI-powered growth team.
          </p>
        </div>
        <div className="relative text-xs text-muted-foreground/70 font-mono">venturelyx.com</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center">
              <Zap className="h-5 w-5 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-heading font-extrabold text-lg">Venturelyx</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl tracking-tight mb-1">
            {isLogin ? "Welcome back" : "Start your business OS"}
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            {isLogin ? "Log in to your command center." : "Create your account in seconds."}
          </p>

          <form onSubmit={submit} className="space-y-4" data-testid="auth-form">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" data-testid="auth-name" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jordan Smith" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" data-testid="auth-email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@business.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" data-testid="auth-password" required value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
            <Button type="submit" disabled={loading} data-testid="auth-submit"
              className="w-full rounded-sm bg-primary hover:bg-primary/90 text-black font-semibold h-11 active:scale-95 transition-transform">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? "Log in" : "Create account"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground mt-6 text-center">
            {isLogin ? "New to Venturelyx? " : "Already have an account? "}
            <Link to={isLogin ? "/register" : "/login"} className="text-primary hover:underline" data-testid="auth-switch">
              {isLogin ? "Create an account" : "Log in"}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
