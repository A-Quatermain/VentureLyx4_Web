import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Search, Loader2, Sparkles, AlertTriangle, CheckCircle2, Zap, Plus, Trash2,
  TrendingUp, TrendingDown, FileText, Wand2, History,
} from "lucide-react";
import { api, streamPost, formatApiError } from "@/lib/api";
import { PageHeader } from "@/components/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const SEV = { high: "text-red-400 border-red-400/30 bg-red-500/5", medium: "text-amber-400 border-amber-400/30 bg-amber-500/5", low: "text-muted-foreground border-white/10 bg-white/5" };

function ScoreRing({ score }) {
  const color = score >= 80 ? "#10B981" : score >= 50 ? "#F97316" : "#EF4444";
  return (
    <div className="relative h-28 w-28">
      <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(score/100)*264} 264`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-bold text-2xl" style={{ color }} data-testid="seo-score">{score}</span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wide">/ 100</span>
      </div>
    </div>
  );
}

export default function ScaleSEO() {
  const { } = {};
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [audit, setAudit] = useState(null);
  const [history, setHistory] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [competitors, setCompetitors] = useState([]);

  // AI recommendation drawer
  const [recOpen, setRecOpen] = useState(false);
  const [recText, setRecText] = useState("");
  const [recLoading, setRecLoading] = useState(false);
  const [recModel, setRecModel] = useState("");

  // page generator
  const [pageForm, setPageForm] = useState({ page_type: "service", topic: "", location: "" });
  const [pageText, setPageText] = useState("");
  const [pageGen, setPageGen] = useState(false);

  const loadAll = async () => {
    const [h, k, c] = await Promise.all([
      api.get("/seo/audits"), api.get("/seo/keywords"), api.get("/seo/competitors"),
    ]);
    setHistory(h.data); setKeywords(k.data); setCompetitors(c.data);
    if (h.data[0] && !audit) setAudit(h.data[0]);
  };
  useEffect(() => { loadAll(); }, []);

  const scan = async () => {
    if (!url) return;
    setScanning(true);
    try {
      const { data } = await api.post("/seo/scan", { url });
      setAudit(data);
      toast.success(`Scan complete — score ${data.score}/100`);
      loadAll();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setScanning(false); }
  };

  const getRecs = async () => {
    if (!audit) return;
    setRecOpen(true); setRecText(""); setRecLoading(true);
    try {
      const { data } = await api.post(`/seo/audits/${audit.id}/recommendations`);
      setRecModel(data.model_name || "");
      // typewriter reveal
      const full = data.text || "No recommendations available.";
      let i = 0;
      const tick = () => { setRecText(full.slice(0, i)); i += 4; if (i < full.length) setTimeout(tick, 12); else setRecText(full); };
      tick();
    } catch (e) { setRecText("Could not generate recommendations."); }
    finally { setRecLoading(false); }
  };

  const generatePage = async () => {
    if (!pageForm.topic) return;
    setPageGen(true); setPageText("");
    try {
      await streamPost("/seo/generate-page", pageForm, (chunk) => setPageText((p) => p + chunk));
    } catch (e) { toast.error("Generation failed"); }
    finally { setPageGen(false); }
  };

  const addKeyword = async (term) => {
    if (!term) return;
    try { await api.post("/seo/keywords", { term }); loadAll(); } catch {}
  };
  const addCompetitor = async (name) => {
    if (!name) return;
    try { await api.post("/seo/competitors", { name }); loadAll(); } catch {}
  };

  const [kwInput, setKwInput] = useState("");
  const [compInput, setCompInput] = useState("");

  return (
    <div className="p-8 lg:p-12 max-w-[1400px]">
      <PageHeader eyebrow="Module" title="ScaleSEO" subtitle="Find what's stopping customers from finding you — then fix it with AI." />

      {/* Scanner */}
      <div className="bg-card border border-white/10 rounded-md p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label className="mb-1.5 block">Website address</Label>
            <Input value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="yourbusiness.com"
              onKeyDown={(e)=>e.key==="Enter"&&scan()} data-testid="seo-url-input" />
          </div>
          <Button onClick={scan} disabled={scanning||!url} data-testid="seo-scan-button"
            className="rounded-sm bg-primary text-black hover:bg-primary/90 h-10 mt-auto font-semibold">
            {scanning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Scanning…</> : <><Search className="h-4 w-4 mr-2"/>Scan my site</>}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="health">
        <TabsList className="bg-transparent border-b border-white/10 rounded-none h-auto p-0 gap-6 mb-6">
          {[["health","SEO Health"],["keywords","Keywords"],["competitors","Competitors"],["generator","AI Page Generator"],["history","History"]].map(([v,l])=>(
            <TabsTrigger key={v} value={v} data-testid={`seo-tab-${v}`}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-1 pb-2">{l}</TabsTrigger>
          ))}
        </TabsList>

        {/* Health */}
        <TabsContent value="health">
          {!audit ? (
            <div className="text-center py-20 text-muted-foreground">Run a scan to see your SEO health.</div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="bg-card border border-white/10 rounded-md p-6 flex flex-col items-center justify-center">
                <ScoreRing score={audit.score} />
                <div className="text-sm text-muted-foreground mt-4 text-center truncate max-w-full">{audit.url}</div>
                <Button onClick={getRecs} className="mt-5 w-full rounded-sm bg-primary text-black hover:bg-primary/90 font-semibold animate-pulse-orange" data-testid="fix-this-button">
                  <Sparkles className="h-4 w-4 mr-2" /> Fix this for me
                </Button>
              </div>
              <div className="lg:col-span-2 space-y-3">
                <div className="text-sm text-muted-foreground mb-1">
                  We found <span className="text-white font-medium">{audit.issues?.length || 0}</span> things to improve.
                </div>
                {(audit.checks || []).map((c) => (
                  <div key={c.key} className={`flex items-start gap-3 p-4 rounded-sm border ${c.passed ? "border-white/10 bg-white/[0.02]" : SEV[c.severity]}`} data-testid={`seo-check-${c.key}`}>
                    {c.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0"/> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0"/>}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{c.label}</span>
                        {!c.passed && <span className="text-[10px] font-mono uppercase">{c.severity}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{c.detail}</div>
                      {!c.passed && <div className="text-xs text-white/70 mt-1">→ {c.fix}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Keywords */}
        <TabsContent value="keywords">
          <div className="flex gap-2 mb-4 max-w-md">
            <Input value={kwInput} onChange={(e)=>setKwInput(e.target.value)} placeholder="e.g. plumber near me" data-testid="keyword-input"
              onKeyDown={(e)=>{if(e.key==="Enter"){addKeyword(kwInput);setKwInput("");}}} />
            <Button className="rounded-sm bg-primary text-black" onClick={()=>{addKeyword(kwInput);setKwInput("");}} data-testid="add-keyword-button"><Plus className="h-4 w-4"/></Button>
          </div>
          <div className="bg-card border border-white/10 rounded-md overflow-hidden">
            <table className="w-full text-sm" data-testid="keywords-table">
              <thead><tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-white/10"><th className="p-4">Keyword</th><th className="p-4">Location</th><th className="p-4">Rank</th><th className="p-4">Volume</th></tr></thead>
              <tbody>{keywords.map((k)=>{const up=k.rank<k.prev_rank;return(
                <tr key={k.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="p-4">{k.term}</td><td className="p-4 text-muted-foreground">{k.location||"—"}</td>
                  <td className="p-4 font-mono">#{k.rank} <span className={`inline-flex items-center text-xs ${up?"text-emerald-400":"text-red-400"}`}>{up?<TrendingUp className="h-3 w-3"/>:<TrendingDown className="h-3 w-3"/>}</span></td>
                  <td className="p-4 font-mono tabular-nums">{k.volume}</td>
                </tr>);})}</tbody>
            </table>
            {keywords.length===0 && <div className="p-8 text-center text-muted-foreground text-sm">Add keywords to track your local rankings.</div>}
          </div>
        </TabsContent>

        {/* Competitors */}
        <TabsContent value="competitors">
          <div className="flex gap-2 mb-4 max-w-md">
            <Input value={compInput} onChange={(e)=>setCompInput(e.target.value)} placeholder="Competitor name" data-testid="competitor-input"
              onKeyDown={(e)=>{if(e.key==="Enter"){addCompetitor(compInput);setCompInput("");}}} />
            <Button className="rounded-sm bg-primary text-black" onClick={()=>{addCompetitor(compInput);setCompInput("");}} data-testid="add-competitor-button"><Plus className="h-4 w-4"/></Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitors.map((c)=>(
              <div key={c.id} className="bg-card border border-white/10 rounded-md p-5" data-testid={`competitor-${c.id}`}>
                <div className="font-medium">{c.name}</div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div><div className="font-mono text-lg text-primary">{c.seo_score}</div><div className="text-[10px] text-muted-foreground uppercase">SEO</div></div>
                  <div><div className="font-mono text-lg">{c.rating}</div><div className="text-[10px] text-muted-foreground uppercase">Rating</div></div>
                  <div><div className="font-mono text-lg">{c.reviews}</div><div className="text-[10px] text-muted-foreground uppercase">Reviews</div></div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* AI Page Generator */}
        <TabsContent value="generator">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card border border-white/10 rounded-md p-6 space-y-4">
              <div className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary"/><span className="font-heading font-bold">Generate a page</span></div>
              <div><Label>Page type</Label>
                <Select value={pageForm.page_type} onValueChange={(v)=>setPageForm({...pageForm,page_type:v})}>
                  <SelectTrigger data-testid="page-type"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="service">Service page</SelectItem><SelectItem value="local">Local landing page</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Topic / service</Label><Input value={pageForm.topic} onChange={(e)=>setPageForm({...pageForm,topic:e.target.value})} placeholder="Emergency AC repair" data-testid="page-topic" /></div>
              <div><Label>Location (optional)</Label><Input value={pageForm.location} onChange={(e)=>setPageForm({...pageForm,location:e.target.value})} placeholder="Austin, TX" /></div>
              <Button onClick={generatePage} disabled={pageGen||!pageForm.topic} className="w-full rounded-sm bg-primary text-black hover:bg-primary/90 font-semibold" data-testid="generate-page-button">
                {pageGen ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Writing…</> : <><Sparkles className="h-4 w-4 mr-2"/>Generate with AI</>}
              </Button>
            </div>
            <div className="bg-[#0c0c0e] border border-white/10 rounded-md p-6 min-h-[400px]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3"><FileText className="h-3.5 w-3.5"/>AI OUTPUT — review before publishing</div>
              {pageText ? (
                <pre className="whitespace-pre-wrap text-sm font-mono text-white/90 leading-relaxed" data-testid="page-output">{pageText}{pageGen && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5"/>}</pre>
              ) : (
                <div className="text-muted-foreground text-sm py-20 text-center">Your generated page will stream here.</div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          <div className="space-y-2">
            {history.map((a)=>(
              <button key={a.id} onClick={()=>setAudit(a)} className="w-full flex items-center justify-between p-4 bg-card border border-white/10 rounded-sm hover:bg-white/[0.03] text-left" data-testid={`audit-history-${a.id}`}>
                <div className="flex items-center gap-3"><History className="h-4 w-4 text-muted-foreground"/><div><div className="text-sm truncate max-w-xs">{a.url}</div><div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div></div></div>
                <span className="font-mono text-lg" style={{color:a.score>=80?"#10B981":a.score>=50?"#F97316":"#EF4444"}}>{a.score}</span>
              </button>
            ))}
            {history.length===0 && <div className="text-center py-12 text-muted-foreground">No scans yet.</div>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Recommendations drawer */}
      <Sheet open={recOpen} onOpenChange={setRecOpen}>
        <SheetContent className="bg-card border-white/10 w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-heading flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary"/>AI SEO Recommendations {recModel && <span className="text-[10px] font-mono text-muted-foreground border border-white/10 rounded px-1.5 py-0.5">{recModel}</span>}</SheetTitle>
          </SheetHeader>
          <div className="mt-6" data-testid="seo-recommendations">
            {recLoading && !recText ? (
              <div className="space-y-3">{[0,1,2,3].map(i=><div key={i} className="h-4 rounded bg-white/5 relative overflow-hidden"><div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent"/></div>)}</div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-white/90 leading-relaxed font-sans">{recText}</pre>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
