import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background grid-noise">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
