import React, { useEffect, useState } from "react";
import { Loader2, Save, Cpu, Bot, Brain, KeyRound } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const PROVIDERS = [
  { key: "auto", label: "Auto (best model per task, with fallback)", desc: "Routes each task to the ideal Claude or GPT model and auto-fails over if one is down." },
  { key: "claude", label: "Prefer Claude (Anthropic)", desc: "Sonnet 5 / 4.6 / Haiku 4.5. Falls back to GPT on error." },
  { key: "gpt", label: "Prefer ChatGPT (OpenAI)", desc: "GPT 5.6 Terra / Luna / 5.4 Mini. Falls back to Claude on error." },
];

export default function Settings() {
  const { business, refreshBusiness } = useAuth();
  const [form, setForm] = useState(null);
  const [usage, setUsage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) setForm({ name: business.name, website: business.website || "", industry: business.industry, service_area: business.service_area || "", ai_preference: business.ai_preference || "auto" });
    api.get("/command-center/ai-usage").then(({ data }) => setUsage(data)).catch(() => {});
  }, [business]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/business", form);
      await refreshBusiness();
      toast.success("Settings saved");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  if (!form) return <div className="p-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="p-8 lg:p-12 max-w-3xl">
      <PageHeader eyebrow="Configuration" title="Settings" subtitle="Manage your business profile and how AI works across Venturelyx." />

      <div className="bg-card border border-white/10 rounded-md p-6 mb-6">
        <div className="font-heading font-bold text-lg mb-4">Business profile</div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Business name</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} data-testid="settings-name" /></div>
          <div><Label>Website</Label><Input value={form.website} onChange={(e)=>setForm({...form,website:e.target.value})} /></div>
          <div><Label>Industry</Label><Input value={form.industry} onChange={(e)=>setForm({...form,industry:e.target.value})} /></div>
          <div><Label>Service area</Label><Input value={form.service_area} onChange={(e)=>setForm({...form,service_area:e.target.value})} /></div>
        </div>
      </div>

      <div className="bg-card border border-white/10 rounded-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-4"><Cpu className="h-4 w-4 text-primary"/><span className="font-heading font-bold text-lg">AI model preference</span></div>
        <div className="space-y-3">
          {PROVIDERS.map((p)=>(
            <button key={p.key} onClick={()=>setForm({...form,ai_preference:p.key})} data-testid={`ai-pref-${p.key}`}
              className={`w-full text-left p-4 rounded-sm border transition-colors ${form.ai_preference===p.key?"border-primary bg-primary/10":"border-white/10 hover:bg-white/[0.03]"}`}>
              <div className="flex items-center gap-2">
                {p.key==="claude"?<Brain className="h-4 w-4"/>:p.key==="gpt"?<Bot className="h-4 w-4"/>:<Cpu className="h-4 w-4"/>}
                <span className="font-medium text-sm">{p.label}</span>
                {form.ai_preference===p.key && <span className="ml-auto text-xs text-primary font-mono">SELECTED</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-white/10 rounded-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-3"><KeyRound className="h-4 w-4 text-primary"/><span className="font-heading font-bold text-lg">AI usage</span></div>
        {usage ? (
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white/[0.03] rounded-sm"><div className="text-xs uppercase tracking-widest text-muted-foreground">Total AI calls</div><div className="font-mono text-2xl mt-1">{usage.total_calls}</div></div>
            {Object.entries(usage.by_provider||{}).map(([prov,v])=>(
              <div key={prov} className="p-4 bg-white/[0.03] rounded-sm"><div className="text-xs uppercase tracking-widest text-muted-foreground capitalize">{prov}</div><div className="font-mono text-2xl mt-1">{v.calls}</div><div className="text-xs text-muted-foreground">~{v.tokens.toLocaleString()} tokens</div></div>
            ))}
          </div>
        ) : <div className="text-sm text-muted-foreground">No AI usage yet.</div>}
        <p className="text-xs text-muted-foreground mt-4">Provider API keys are stored securely on the server. Add your own Anthropic & OpenAI keys in <span className="font-mono">backend/.env</span> to use your own accounts; otherwise the shared key is used.</p>
      </div>

      <Button onClick={save} disabled={saving} className="rounded-sm bg-primary text-black hover:bg-primary/90 font-semibold" data-testid="settings-save-button">
        {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Save className="h-4 w-4 mr-2"/>Save settings</>}
      </Button>
    </div>
  );
}
