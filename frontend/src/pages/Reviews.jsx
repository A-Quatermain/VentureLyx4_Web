import React, { useEffect, useState } from "react";
import { Star, Sparkles, Loader2, Send, CheckCircle2, Plus, MessageSquare } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, Cell } from "recharts";
import { api, streamPost, formatApiError } from "@/lib/api";
import { PageHeader } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

function Stars({ n }) {
  return <div className="flex gap-0.5">{[1,2,3,4,5].map(i=><Star key={i} className={`h-3.5 w-3.5 ${i<=n?"fill-primary text-primary":"text-white/20"}`} />)}</div>;
}

export default function Reviews() {
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [drafts, setDrafts] = useState({}); // id -> text
  const [drafting, setDrafting] = useState(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqForm, setReqForm] = useState({ customer_name: "", channel: "email", contact: "" });

  const load = async () => {
    const [s, r] = await Promise.all([api.get("/reviews/summary"), api.get("/reviews")]);
    setSummary(s.data); setReviews(r.data);
    const d = {}; r.data.forEach((rv)=>{ if(rv.ai_response) d[rv.id]=rv.ai_response; });
    setDrafts(d);
  };
  useEffect(() => { load(); }, []);

  const draft = async (rv) => {
    setDrafting(rv.id);
    setDrafts((p)=>({ ...p, [rv.id]: "" }));
    try {
      await streamPost(`/reviews/${rv.id}/ai-response`, {}, (chunk)=>setDrafts((p)=>({ ...p, [rv.id]: (p[rv.id]||"")+chunk })));
    } catch { toast.error("Could not draft response"); }
    finally { setDrafting(null); }
  };

  const approve = async (rv) => {
    try {
      await api.post(`/reviews/${rv.id}/approve`, { response_text: drafts[rv.id] });
      toast.success("Response approved & published");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const sendRequest = async () => {
    try {
      const { data } = await api.post("/reviews/requests", reqForm);
      toast.success(data.message);
      setReqOpen(false); setReqForm({ customer_name: "", channel: "email", contact: "" }); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const dist = summary ? [5,4,3,2,1].map((s)=>({ star:`${s}★`, n: summary.distribution[s]||0 })) : [];

  return (
    <div className="p-8 lg:p-12 max-w-[1400px]">
      <PageHeader eyebrow="Module" title="Reviews & Reputation" subtitle="Track your stars and reply to every customer with an AI-drafted response."
        actions={
          <Dialog open={reqOpen} onOpenChange={setReqOpen}>
            <DialogTrigger asChild><Button className="rounded-sm bg-primary text-black hover:bg-primary/90" data-testid="request-review-button"><Plus className="h-4 w-4 mr-1"/>Request a review</Button></DialogTrigger>
            <DialogContent className="bg-card border-white/10">
              <DialogHeader><DialogTitle className="font-heading">Request a review</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Customer name</Label><Input value={reqForm.customer_name} onChange={(e)=>setReqForm({...reqForm,customer_name:e.target.value})} data-testid="request-customer" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Channel</Label><Select value={reqForm.channel} onValueChange={(v)=>setReqForm({...reqForm,channel:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent></Select></div>
                  <div><Label>Contact</Label><Input value={reqForm.contact} onChange={(e)=>setReqForm({...reqForm,contact:e.target.value})} placeholder="email / phone" /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={sendRequest} disabled={!reqForm.customer_name} className="rounded-sm bg-primary text-black" data-testid="send-request-button"><Send className="h-4 w-4 mr-1"/>Send request</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {summary && (
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-white/10 rounded-md p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Average</div>
            <div className="flex items-end gap-2"><span className="font-mono font-bold text-4xl text-primary" data-testid="review-average">{summary.average}</span><Star className="h-5 w-5 fill-primary text-primary mb-1.5"/></div>
          </div>
          <div className="bg-card border border-white/10 rounded-md p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Total reviews</div>
            <div className="font-mono font-bold text-4xl">{summary.count}</div>
          </div>
          <div className="bg-card border border-white/10 rounded-md p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Requests sent</div>
            <div className="font-mono font-bold text-4xl">{summary.requests_sent}</div>
          </div>
          <div className="bg-card border border-white/10 rounded-md p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Distribution</div>
            <div className="h-14"><ResponsiveContainer width="100%" height="100%"><BarChart data={dist}><XAxis dataKey="star" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false}/><Bar dataKey="n" radius={2}>{dist.map((e,i)=><Cell key={i} fill="#F97316"/>)}</Bar></BarChart></ResponsiveContainer></div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {reviews.map((rv)=>(
          <div key={rv.id} className="bg-card border border-white/10 rounded-md p-6" data-testid={`review-${rv.id}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3"><span className="font-medium">{rv.author}</span><Stars n={rv.rating}/><span className="text-xs text-muted-foreground">{rv.source}</span></div>
                <p className="text-sm text-white/80 mt-2 max-w-2xl">{rv.text}</p>
              </div>
              {rv.response_status === "approved"
                ? <span className="text-xs text-emerald-400 inline-flex items-center gap-1 shrink-0"><CheckCircle2 className="h-3.5 w-3.5"/>Replied</span>
                : <Button size="sm" variant="outline" onClick={()=>draft(rv)} disabled={drafting===rv.id} className="rounded-sm border-primary/40 text-primary hover:bg-primary hover:text-black shrink-0" data-testid={`draft-reply-${rv.id}`}>
                    {drafting===rv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <><Sparkles className="h-3.5 w-3.5 mr-1"/>Draft AI reply</>}
                  </Button>}
            </div>

            {(drafts[rv.id] !== undefined && rv.response_status !== "approved") && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1"><MessageSquare className="h-3 w-3"/>AI-drafted reply — edit & approve</div>
                <Textarea value={drafts[rv.id]} onChange={(e)=>setDrafts((p)=>({ ...p, [rv.id]: e.target.value }))} className="min-h-[90px] bg-[#0c0c0e]" data-testid={`reply-textarea-${rv.id}`} />
                <div className="flex justify-end mt-2">
                  <Button size="sm" onClick={()=>approve(rv)} disabled={!drafts[rv.id] || drafting===rv.id} className="rounded-sm bg-primary text-black hover:bg-primary/90" data-testid={`approve-reply-${rv.id}`}>Approve & publish</Button>
                </div>
              </div>
            )}
            {rv.response_status === "approved" && rv.ai_response && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="text-xs text-muted-foreground mb-1">Your reply</div>
                <p className="text-sm text-white/70">{rv.ai_response}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
