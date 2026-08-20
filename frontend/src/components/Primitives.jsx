import React from "react";
import { motion } from "framer-motion";

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div>
        {eyebrow && <div className="text-xs uppercase tracking-widest text-primary mb-2 font-medium">{eyebrow}</div>}
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-2 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stagger({ children, className }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
