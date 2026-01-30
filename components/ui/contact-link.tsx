"use client";

import { useState } from "react";
import { ContactModal } from "./contact-modal";
import { cn } from "@/lib/utils";

interface ContactLinkProps {
  children?: React.ReactNode;
  className?: string;
}

export function ContactLink({ children = "Contact us", className }: ContactLinkProps) {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsContactModalOpen(true)}
        className={cn("hover:underline cursor-pointer", className)}
      >
        {children}
      </button>
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </>
  );
}
