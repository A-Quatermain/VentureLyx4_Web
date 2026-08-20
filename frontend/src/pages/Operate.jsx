import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Loader2, CreditCard, CheckCircle2, Trash2, User, Calendar } from "lucide-react";
import { api, money, formatApiError } from "@/lib/api";
import { PageHeader } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "quoted", label: "Quoted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

function PipelineBoard({ leads, onMove, onReload }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", value: 0, stage: "new", source: "Manual" });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    setSaving(true);
    try {
      await api.post("/operate/leads", { ...form, value: Number(form.value) || 0 });
      toast.success("Lead added");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", value: 0, stage: "new", source: "Manual" });
      onReload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          Pipeline value: <span className="font-mono text-white">{money(leads.filter(l => ["new","contacted","quoted"].includes(l.stage)).reduce((s,l)=>s+(l.value||0),0))}</span>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-sm bg-primary text-black hover:bg-primary/90" data-testid="add-lead-button"><Plus className="h-4 w-4 mr-1" /> Add lead</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10">
            <DialogHeader><DialogTitle className="font-heading">New lead</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input data-testid="lead-name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Est. value ($)</Label><Input type="number" data-testid="lead-value" value={form.value} onChange={(e)=>setForm({...form,value:e.target.value})} /></div>
                <div><Label>Stage</Label>
                  <Select value={form.stage} onValueChange={(v)=>setForm({...form,stage:v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map(s=><SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={add} disabled={saving||!form.name} className="rounded-sm bg-primary text-black" data-testid="save-lead-button">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:"Save lead"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="pipeline-board">
        {STAGES.map((s) => {
          const items = leads.filter((l) => l.stage === s.key);
          return (
            <div key={s.key} className="w-72 shrink-0 bg-zinc-900/50 border border-white/10 rounded-md p-3" data-testid={`pipeline-stage-${s.key}`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</span>
                <span className="text-xs font-mono text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[40px]">
                {items.map((l) => (
                  <motion.div key={l.id} layout className="bg-card border border-white/10 rounded-sm p-3" data-testid={`lead-card-${l.id}`}>
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-sm">{l.name}</div>
                      <div className="font-mono text-sm text-primary">{money(l.value)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{l.source} · {l.phone}</div>
                    <Select value={l.stage} onValueChange={(v)=>onMove(l.id, v)}>
                      <SelectTrigger className="h-7 mt-2 text-xs" data-testid={`move-lead-${l.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{STAGES.map(st=><SelectItem key={st.key} value={st.key}>{st.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Invoices({ invoices, onReload }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_name: "", description: "Services", amount: "" });
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(null);

  const add = async () => {
    setSaving(true);
    try {
      await api.post("/operate/invoices", { ...form, amount: Number(form.amount) });
      toast.success("Invoice created");
      setOpen(false); setForm({ customer_name: "", description: "Services", amount: "" }); onReload();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const pay = async (inv) => {
    setPaying(inv.id);
    try {
      const { data } = await api.post("/payments/checkout", { invoice_id: inv.id, origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); setPaying(null); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="rounded-sm bg-primary text-black hover:bg-primary/90" data-testid="add-invoice-button"><Plus className="h-4 w-4 mr-1" /> New invoice</Button></DialogTrigger>
          <DialogContent className="bg-card border-white/10">
            <DialogHeader><DialogTitle className="font-heading">New invoice</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Customer name</Label><Input data-testid="invoice-customer" value={form.customer_name} onChange={(e)=>setForm({...form,customer_name:e.target.value})} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} /></div>
              <div><Label>Amount ($)</Label><Input type="number" data-testid="invoice-amount" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})} /></div>
            </div>
            <DialogFooter><Button onClick={add} disabled={saving||!form.customer_name||!form.amount} className="rounded-sm bg-primary text-black" data-testid="save-invoice-button">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:"Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-card border border-white/10 rounded-md overflow-hidden">
        <table className="w-full text-sm" data-testid="invoices-table">
          <thead><tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-white/10">
            <th className="p-4">Invoice</th><th className="p-4">Customer</th><th className="p-4">Amount</th><th className="p-4">Status</th><th className="p-4"></th></tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="p-4 font-mono">{inv.number}</td>
                <td className="p-4">{inv.customer_name}<div className="text-xs text-muted-foreground">{inv.description}</div></td>
                <td className="p-4 font-mono tabular-nums">{money(inv.amount)}</td>
                <td className="p-4">
                  {inv.status === "paid"
                    ? <span className="inline-flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 className="h-3.5 w-3.5"/>Paid</span>
                    : <span className="text-amber-400 text-xs capitalize">{inv.status}</span>}
                </td>
                <td className="p-4 text-right">
                  {inv.status !== "paid" && (
                    <Button size="sm" variant="outline" className="rounded-sm border-primary/40 text-primary hover:bg-primary hover:text-black h-8" onClick={()=>pay(inv)} disabled={paying===inv.id} data-testid={`pay-invoice-${inv.id}`}>
                      {paying===inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <><CreditCard className="h-3.5 w-3.5 mr-1"/>Collect</>}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Operate() {
  const [leads, setLeads] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);

  const loadAll = async () => {
    const [l, j, i, c] = await Promise.all([
      api.get("/operate/leads"), api.get("/operate/jobs"),
      api.get("/operate/invoices"), api.get("/operate/customers"),
    ]);
    setLeads(l.data); setJobs(j.data); setInvoices(i.data); setCustomers(c.data);
  };
  useEffect(() => { loadAll(); }, []);

  const move = async (id, stage) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, stage } : l));
    try { await api.put(`/operate/leads/${id}/stage`, { stage }); } catch { loadAll(); }
  };

  return (
    <div className="p-8 lg:p-12 max-w-[1400px]">
      <PageHeader eyebrow="Module" title="Operate" subtitle="Run the day-to-day: leads, jobs, customers and getting paid." />
      <Tabs defaultValue="pipeline">
        <TabsList className="bg-transparent border-b border-white/10 rounded-none h-auto p-0 gap-6 mb-6">
          {["pipeline","jobs","invoices","customers"].map((t)=>(
            <TabsTrigger key={t} value={t} data-testid={`operate-tab-${t}`}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-1 pb-2 capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="pipeline"><PipelineBoard leads={leads} onMove={move} onReload={loadAll} /></TabsContent>

        <TabsContent value="jobs">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((j)=>(
              <div key={j.id} className="bg-card border border-white/10 rounded-md p-5" data-testid={`job-card-${j.id}`}>
                <div className="flex items-start justify-between">
                  <div className="font-medium">{j.title}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-sm ${j.status==="done"?"bg-emerald-500/15 text-emerald-400":j.status==="in_progress"?"bg-amber-500/15 text-amber-400":"bg-white/5 text-muted-foreground"}`}>{j.status.replace("_"," ")}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-2 flex items-center gap-1"><User className="h-3.5 w-3.5"/>{j.customer_name||"—"}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="invoices"><Invoices invoices={invoices} onReload={loadAll} /></TabsContent>

        <TabsContent value="customers">
          <div className="bg-card border border-white/10 rounded-md overflow-hidden">
            <table className="w-full text-sm" data-testid="customers-table">
              <thead><tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-white/10"><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Phone</th></tr></thead>
              <tbody>{customers.map((c)=>(<tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.03]"><td className="p-4">{c.name}</td><td className="p-4 text-muted-foreground">{c.email}</td><td className="p-4 font-mono">{c.phone}</td></tr>))}</tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
