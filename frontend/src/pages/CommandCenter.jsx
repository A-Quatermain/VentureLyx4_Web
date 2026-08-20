import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, Users, Search, Star, Briefcase, TrendingUp, Sparkles,
  ArrowUpRight, Loader2, RefreshCw, Wallet,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { api, money } from "@/lib/api";
import GrowthGauge from "@/components/GrowthGauge";
import { PageHeader, Stagger, StaggerItem } from "@/components/Primitives";
import { Button } from "@/components/ui/button";

const IMPACT = { High: "text-primary border-primary/40", Medium: "text-amber-400 border-amber-400/30", Low: "text-muted-foreground border-white/10" };

function Metric({ icon: Icon, label, value, sub, testid }) {
  return (
    <StaggerItem className="bg-card border border-white/10 rounded-md p-5 h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="font-mono font-bold text-3xl tracking-tight" data-testid={testid}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </StaggerItem>
  );
}

export default function CommandCenter() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [nba, setNba] = useState(null);
  const [nbaLoading, setNbaLoading] = useState(true);

  const load = async () => {
    const { data } = await api.get("/command-center/summary");
    setData(data);
  };
  const loadNba = async () => {
    setNbaLoading(true);
    try {
      const { data } = await api.get("/command-center/next-best-action");
      setNba(data);
    } finally { setNbaLoading(false); }
  };

  useEffect(() => { load(); loadNba(); }, []);

  if (!data) return <div className="p-12 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading command center…</div>;

  const m = data.metrics;
  const revenueTrend = [
    { m: "Mar", v: 2200 }, { m: "Apr", v: 3100 }, { m: "May", v: 2800 },
    { m: "Jun", v: 4200 }, { m: "Jul", v: 3900 }, { m: "Now", v: m.revenue + 2000 },
  ];

  return (
    <div className="p-8 lg:p-12 max-w-[1400px]">
      <PageHeader
        eyebrow={`${data.business.name} · ${data.business.industry}`}
        title="Command Center"
        subtitle="Everything that moves your business, in one place."
      />

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Growth score */}
        <div className="bg-card border border-white/10 rounded-md p-6 flex flex-col items-center justify-center">
          <GrowthGauge score={m.growth_score} />
          <p className="text-sm text-muted-foreground text-center mt-4 max-w-[220px]">
            Your blended health across SEO, leads, revenue and reputation.
          </p>
        </div>

        {/* Next best action */}
        <div className="lg:col-span-2 tracing-border rounded-md p-6" data-testid="next-best-action">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-heading font-bold text-lg tracking-tight">Next Best Actions</span>
              {nba?.model && <span className="text-[10px] font-mono text-muted-foreground border border-white/10 rounded px-1.5 py-0.5">{nba.model}</span>}
            </div>
            <Button variant="ghost" size="sm" onClick={loadNba} className="h-8 text-muted-foreground hover:text-white" data-testid="nba-refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${nbaLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {nbaLoading && !nba ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-sm bg-white/5 relative overflow-hidden">
                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(nba?.actions || []).map((a, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-sm bg-white/5 hover:bg-white/[0.07] transition-colors group cursor-pointer"
                  onClick={() => navigate(a.module === "ScaleSEO" ? "/scaleseo" : a.module === "Reviews" ? "/reviews" : "/operate")}
                  data-testid={`nba-action-${i}`}>
                  <div className={`text-[10px] font-mono uppercase border rounded px-1.5 py-0.5 mt-0.5 ${IMPACT[a.impact] || IMPACT.Low}`}>{a.impact}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{a.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.why}</div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Metric icon={DollarSign} label="Revenue" value={money(m.revenue)} sub={`${money(m.outstanding)} outstanding`} testid="metric-revenue" />
        <Metric icon={TrendingUp} label="Pipeline" value={money(m.pipeline_value)} sub={`${m.open_leads} open leads`} testid="metric-pipeline" />
        <Metric icon={Users} label="Customers" value={m.customers} sub={`${m.won_leads} won this cycle`} testid="metric-customers" />
        <Metric icon={Search} label="SEO Score" value={m.seo_score || "—"} sub={m.seo_score ? "from last scan" : "run a scan"} testid="metric-seo" />
        <Metric icon={Star} label="Reputation" value={m.rating || "—"} sub={`${m.review_count} reviews`} testid="metric-reviews" />
        <Metric icon={Briefcase} label="Jobs" value={m.upcoming_jobs} sub={`${m.total_jobs} total`} testid="metric-jobs" />
        <Metric icon={Wallet} label="Outstanding" value={money(m.outstanding)} sub="unpaid invoices" testid="metric-outstanding" />
        <Metric icon={TrendingUp} label="Growth" value={`${m.growth_score}/100`} sub="overall health" testid="metric-growth" />
      </Stagger>

      <div className="bg-card border border-white/10 rounded-md p-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Revenue trend</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueTrend}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="m" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#18181B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6 }} labelStyle={{ color: "#fff" }} />
              <Area type="monotone" dataKey="v" stroke="#F97316" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
