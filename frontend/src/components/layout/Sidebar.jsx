import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Hammer, Boxes, Briefcase, Search, Star,
  Megaphone, Bot, Settings, Lock, LogOut, Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const V1 = [
  { to: "/", label: "Command Center", icon: LayoutDashboard, testid: "nav-command-center", end: true },
  { to: "/operate", label: "Operate", icon: Briefcase, testid: "nav-operate" },
  { to: "/scaleseo", label: "ScaleSEO", icon: Search, testid: "nav-scaleseo" },
  { to: "/reviews", label: "Reviews", icon: Star, testid: "nav-reviews" },
];

const LOCKED = [
  { label: "Build", icon: Hammer, testid: "nav-build" },
  { label: "Source", icon: Boxes, testid: "nav-source" },
  { label: "Grow", icon: Megaphone, testid: "nav-grow" },
  { label: "AI Team", icon: Bot, testid: "nav-ai-team" },
];

export default function Sidebar() {
  const { business, logout } = useAuth();
  const navigate = useNavigate();

  const linkCls = ({ isActive }) =>
    `group flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors ${
      isActive ? "bg-primary/15 text-white border-l-2 border-primary" : "text-muted-foreground hover:text-white hover:bg-white/5 border-l-2 border-transparent"
    }`;

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-[#0c0c0e] border-r border-white/10 flex flex-col" data-testid="sidebar">
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-heading font-extrabold text-lg tracking-tight leading-none">Venturelyx</div>
            <div className="text-[10px] text-muted-foreground tracking-wide">BUSINESS OS</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {V1.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.end} className={linkCls} data-testid={m.testid}>
            <m.icon className="h-4 w-4" />
            <span className="font-medium">{m.label}</span>
          </NavLink>
        ))}

        <div className="px-3 pt-5 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground/60">Coming soon</div>
        {LOCKED.map((m) => (
          <div key={m.label} className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm opacity-40 cursor-not-allowed select-none" data-testid={m.testid} title="Coming soon">
            <m.icon className="h-4 w-4" />
            <span className="font-medium">{m.label}</span>
            <Lock className="h-3 w-3 ml-auto" />
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10 space-y-1">
        <NavLink to="/settings" className={linkCls} data-testid="nav-settings">
          <Settings className="h-4 w-4" />
          <span className="font-medium">Settings</span>
        </NavLink>
        <div className="px-3 py-2 text-xs text-muted-foreground truncate">{business?.name}</div>
        <button
          onClick={async () => { await logout(); navigate("/login"); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
          data-testid="logout-button"
        >
          <LogOut className="h-4 w-4" />
          <span className="font-medium">Log out</span>
        </button>
      </div>
    </aside>
  );
}
