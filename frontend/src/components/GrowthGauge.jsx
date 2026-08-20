import React from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

export default function GrowthGauge({ score = 0, size = 200 }) {
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#F97316" : "#EF4444";
  const data = [{ name: "score", value: score, fill: color }];
  return (
    <div style={{ width: size, height: size }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={225} endAngle={-45}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: "rgba(255,255,255,0.06)" }} dataKey="value" cornerRadius={8} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono font-bold text-5xl tracking-tight" style={{ color }} data-testid="growth-score-value">{score}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Growth Score</div>
      </div>
    </div>
  );
}
