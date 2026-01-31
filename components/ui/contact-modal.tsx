"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, User, Phone, MessageSquare, CheckCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { addContactSubmission } from "@/lib/supabase";

// Form validation schema
const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetMessage?: string;
}

export function ContactModal({ isOpen, onClose, presetMessage }: ContactModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  // Set preset message when provided (e.g., from Cohort application)
  useEffect(() => {
    if (presetMessage && isOpen) {
      setValue('message', presetMessage);
    }
  }, [presetMessage, isOpen, setValue]);

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await addContactSubmission({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        message: data.message,
      });
      setIsSuccess(true);
      reset();
      // Auto close after success
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
      }, 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setIsSuccess(false);
      setError(null);
      reset();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4"
          >
            <div className="relative rounded-2xl overflow-hidden">
              {/* Gradient border effect */}
              <div
                className="absolute -inset-[1px] rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, rgba(232,228,217,0.3) 0%, rgba(4,120,87,0.3) 50%, rgba(232,228,217,0.3) 100%)",
                }}
              />

              {/* Modal content */}
              <div className="relative bg-[rgba(10,10,11,0.98)] backdrop-blur-xl rounded-2xl p-6 md:p-8">
                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-ivory/60" />
                </button>

                {/* Success State */}
                {isSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4"
                    >
                      <CheckCircle className="w-8 h-8 text-emerald-400" />
                    </motion.div>
                    <h3 className="text-xl font-semibold text-ivory mb-2">Message Sent!</h3>
                    <p className="text-ivory/60 text-sm">
                      Thank you for reaching out. We&apos;ll get back to you soon.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-serif font-semibold text-ivory mb-2">
                        Contact Us
                      </h2>
                      <p className="text-ivory/60 text-sm">
                        Have a question? We&apos;d love to hear from you.
                      </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                      {/* Name Field */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-ivory/70 uppercase tracking-wider">
                          Name *
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ivory/40" />
                          <input
                            {...register("name")}
                            type="text"
                            placeholder="Your name"
                            className={cn(
                              "w-full h-12 pl-10 pr-4 rounded-lg",
                              "bg-white/5 border border-white/10",
                              "text-ivory placeholder:text-ivory/30",
                              "focus:outline-none focus:border-champagne/50 focus:ring-1 focus:ring-champagne/30",
                              "transition-all duration-300",
                              errors.name && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30"
                            )}
                          />
                        </div>
                        {errors.name && (
                          <p className="text-xs text-red-400">{errors.name.message}</p>
                        )}
                      </div>

                      {/* Email Field */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-ivory/70 uppercase tracking-wider">
                          Email *
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ivory/40" />
                          <input
                            {...register("email")}
                            type="email"
                            placeholder="you@example.com"
                            className={cn(
                              "w-full h-12 pl-10 pr-4 rounded-lg",
                              "bg-white/5 border border-white/10",
                              "text-ivory placeholder:text-ivory/30",
                              "focus:outline-none focus:border-champagne/50 focus:ring-1 focus:ring-champagne/30",
                              "transition-all duration-300",
                              errors.email && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30"
                            )}
                          />
                        </div>
                        {errors.email && (
                          <p className="text-xs text-red-400">{errors.email.message}</p>
                        )}
                      </div>

                      {/* Phone Field (Optional) */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-ivory/70 uppercase tracking-wider">
                          Phone <span className="text-ivory/40">(Optional)</span>
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ivory/40" />
                          <input
                            {...register("phone")}
                            type="tel"
                            placeholder="+1 (555) 123-4567"
                            className={cn(
                              "w-full h-12 pl-10 pr-4 rounded-lg",
                              "bg-white/5 border border-white/10",
                              "text-ivory placeholder:text-ivory/30",
                              "focus:outline-none focus:border-champagne/50 focus:ring-1 focus:ring-champagne/30",
                              "transition-all duration-300"
                            )}
                          />
                        </div>
                      </div>

                      {/* Message Field */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-ivory/70 uppercase tracking-wider">
                          Message *
                        </label>
                        <div className="relative">
                          <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-ivory/40" />
                          <textarea
                            {...register("message")}
                            placeholder="How can we help you?"
                            rows={4}
                            className={cn(
                              "w-full pl-10 pr-4 py-3 rounded-lg resize-none",
                              "bg-white/5 border border-white/10",
                              "text-ivory placeholder:text-ivory/30",
                              "focus:outline-none focus:border-champagne/50 focus:ring-1 focus:ring-champagne/30",
                              "transition-all duration-300",
                              errors.message && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30"
                            )}
                          />
                        </div>
                        {errors.message && (
                          <p className="text-xs text-red-400">{errors.message.message}</p>
                        )}
                      </div>

                      {/* Error Message */}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 rounded-lg bg-red-500/10 border border-red-500/30"
                        >
                          <p className="text-sm text-red-400 text-center">{error}</p>
                        </motion.div>
                      )}

                      {/* Submit Button */}
                      <motion.button
                        type="submit"
                        disabled={isSubmitting}
                        className={cn(
                          "w-full h-14 rounded-xl font-semibold text-base",
                          "bg-gradient-to-r from-champagne-dark via-champagne to-champagne-light",
                          "text-onyx",
                          "hover:shadow-[0_0_30px_rgba(232,228,217,0.4)]",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          "transition-all duration-500",
                          "flex items-center justify-center gap-2"
                        )}
                        whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                        whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <span>Send Message</span>
                        )}
                      </motion.button>

                      {/* Privacy Note */}
                      <p className="text-xs text-center text-ivory/40">
                        We respect your privacy and will respond within 24-48 hours.
                      </p>
                    </form>
                  </>
                )}

                {/* Decorative corner accents */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-champagne/20 rounded-tl-2xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-champagne/20 rounded-tr-2xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-champagne/20 rounded-bl-2xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-champagne/20 rounded-br-2xl" />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook for managing modal state
export function useContactModal() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
