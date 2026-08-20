import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Loader2, ArrowRight } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function Onboarding() {
  const { refreshBusiness, user } = useAuth();
  const navigate = useNavigate();
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", website: "", industry: "Home Services", service_area: "" });

  useEffect(() => {
    api.get("/industries").then(({ data }) => setIndustries(data.industries)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/business/onboard", form);
      await refreshBusiness();
      toast.success("Your business is set up.");
      navigate("/");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background grid-noise">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="w-full max-w-lg bg-card border border-white/10 rounded-md p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-heading font-extrabold text-lg">Venturelyx</span>
        </div>
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Let's set up your business</div>
        <h1 className="font-heading font-extrabold text-3xl tracking-tight mb-2">
          Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          Tell us a bit about your business so we can tailor your command center.
        </p>

        <form onSubmit={submit} className="space-y-5" data-testid="onboarding-form">
          <div className="space-y-1.5">
            <Label htmlFor="bname">Business name</Label>
            <Input id="bname" required data-testid="onboard-name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bright Spark Home Services" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="web">Website (optional)</Label>
            <Input id="web" data-testid="onboard-website" value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://yourbusiness.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                <SelectTrigger data-testid="onboard-industry"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area">Service area</Label>
              <Input id="area" data-testid="onboard-area" value={form.service_area}
                onChange={(e) => setForm({ ...form, service_area: e.target.value })} placeholder="Austin, TX" />
            </div>
          </div>
          <Button type="submit" disabled={loading} data-testid="onboard-submit"
            className="w-full rounded-sm bg-primary hover:bg-primary/90 text-black font-semibold h-11 active:scale-95 transition-transform">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enter my command center <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
