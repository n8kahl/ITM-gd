"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface RibbonDividerProps {
  className?: string;
  flip?: boolean;
}

export function RibbonDivider({ className, flip = false }: RibbonDividerProps) {
  return (
    <motion.div
      className={cn(
        "relative w-full h-16 md:h-24 overflow-hidden opacity-60",
        flip && "scale-x-[-1]",
        className
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 0.6, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <Image
        src="/ribbon-bg.png"
        alt=""
        fill
        className="object-cover object-center"
        aria-hidden="true"
      />
      {/* Gradient fade on edges */}
      <div className="absolute inset-0 bg-gradient-to-r from-void via-transparent to-void" />
    </motion.div>
  );
}
