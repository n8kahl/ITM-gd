"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, CheckCircle, Loader2, User, Mail, MessageSquare } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { addContactSubmission, ApplicationMetadata } from "@/lib/supabase";

// Form validation schemas for each step
const step1Schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  discord_handle: z.string().min(2, "Discord handle is required"),
});

const step2Schema = z.object({
  experience_level: z.enum(["< 1 Year", "1-3 Years", "3+ Years"]),
  account_size: z.enum(["Under $5k", "$5k - $25k", "$25k+"]),
});

const step3Schema = z.object({
  primary_struggle: z.enum(["Psychology", "Risk Management", "Strategy", "Consistency", "Other"]),
  short_term_goal: z.string().min(10, "Please share a bit more about your goals"),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

interface CohortApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  { title: "Basic Info", description: "Let's get to know you" },
  { title: "Experience", description: "Your trading journey" },
  { title: "Goals", description: "What you want to achieve" },
];

const EXPERIENCE_OPTIONS = [
  { value: "< 1 Year", label: "< 1 Year", description: "Just getting started" },
  { value: "1-3 Years", label: "1-3 Years", description: "Building foundations" },
  { value: "3+ Years", label: "3+ Years", description: "Experienced trader" },
] as const;

const ACCOUNT_SIZE_OPTIONS = [
  { value: "Under $5k", label: "Under $5k", description: "Starting small" },
  { value: "$5k - $25k", label: "$5k - $25k", description: "Growing account" },
  { value: "$25k+", label: "$25k+", description: "Serious capital" },
] as const;

const STRUGGLE_OPTIONS = [
  { value: "Psychology", label: "Psychology" },
  { value: "Risk Management", label: "Risk Management" },
  { value: "Strategy", label: "Finding a Strategy" },
  { value: "Consistency", label: "Consistency" },
  { value: "Other", label: "Other" },
] as const;

export function CohortApplicationModal({ isOpen, onClose }: CohortApplicationModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState<Partial<Step1Data & Step2Data & Step3Data>>({});

  // Step 1 form
  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: formData,
  });

  // Step 2 form
  const step2Form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: formData,
  });

  // Step 3 form
  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: formData,
  });

  const handleStep1Submit = (data: Step1Data) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(1);
  };

  const handleStep2Submit = (data: Step2Data) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  const handleFinalSubmit = async (data: Step3Data) => {
    const fullData = { ...formData, ...data };
    setIsSubmitting(true);

    try {
      const metadata: ApplicationMetadata = {
        discord_handle: fullData.discord_handle,
        experience_level: fullData.experience_level,
        account_size: fullData.account_size,
        primary_struggle: fullData.primary_struggle,
        short_term_goal: fullData.short_term_goal,
        source: 'Application Wizard',
      };

      await addContactSubmission({
        name: fullData.name!,
        email: fullData.email!,
        message: `Precision Cohort Application\n\nDiscord: ${fullData.discord_handle}\nExperience: ${fullData.experience_level}\nAccount Size: ${fullData.account_size}\nPrimary Struggle: ${fullData.primary_struggle}\n\nShort-term Goal:\n${fullData.short_term_goal}`,
        submission_type: 'cohort_application',
        metadata,
      });

      setIsSuccess(true);
      // Redirect to Whop checkout after brief success message
      setTimeout(() => {
        window.location.href = 'https://whop.com/checkout/plan_T4Ymve5JhqpY7';
      }, 2000);
    } catch (error) {
      console.error('Application submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setTimeout(() => {
        setCurrentStep(0);
        setFormData({});
        setIsSuccess(false);
      }, 300);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Progress percentage
  const progress = ((currentStep + 1) / STEPS.length) * 100;

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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg px-4"
          >
            <div className="relative rounded-2xl overflow-hidden glass-card-heavy">
              {/* Gold/Platinum gradient border */}
              <div
                className="absolute -inset-[1px] rounded-2xl pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, rgba(16, 185, 129,0.4) 0%, rgba(232,228,217,0.3) 50%, rgba(16, 185, 129,0.4) 100%)",
                }}
              />

              {/* Modal content */}
              <div className="relative bg-[rgba(10,10,11,0.98)] backdrop-blur-xl rounded-2xl">
                {/* Progress bar */}
                <div className="h-1 bg-white/5">
                  <motion.div
                    className="h-full bg-gradient-to-r from-champagne via-emerald-500 to-champagne"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>

                {/* Header */}
                <div className="p-6 pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-serif font-semibold text-ivory">
                        {isSuccess ? "Application Submitted!" : STEPS[currentStep].title}
                      </h2>
                      {!isSuccess && (
                        <p className="text-sm text-ivory/60 mt-1">
                          Step {currentStep + 1} of {STEPS.length} — {STEPS[currentStep].description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleClose}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4 text-ivory/60" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <AnimatePresence mode="wait">
                    {isSuccess ? (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-center py-8"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4"
                        >
                          <CheckCircle className="w-8 h-8 text-[#10B981]" />
                        </motion.div>
                        <h3 className="text-xl font-semibold text-ivory mb-2">You&apos;re In The Running!</h3>
                        <p className="text-ivory/60 text-sm max-w-sm mx-auto">
                          We review applications personally. Expect to hear from us within 24-48 hours.
                        </p>
                      </motion.div>
                    ) : currentStep === 0 ? (
                      <motion.form
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onSubmit={step1Form.handleSubmit(handleStep1Submit)}
                        className="space-y-4"
                      >
                        {/* Name */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-ivory/70 uppercase tracking-wider">
                            Full Name *
                          </label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ivory/40" />
                            <input
                              {...step1Form.register("name")}
                              type="text"
                              placeholder="Your name"
                              className={cn(
                                "w-full h-12 pl-10 pr-4 rounded-lg",
                                "bg-white/5 border border-white/10",
                                "text-ivory placeholder:text-ivory/30",
                                "focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30",
                                "transition-all duration-300",
                                step1Form.formState.errors.name && "border-red-500/50"
                              )}
                            />
                          </div>
                          {step1Form.formState.errors.name && (
                            <p className="text-xs text-red-400">{step1Form.formState.errors.name.message}</p>
                          )}
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-ivory/70 uppercase tracking-wider">
                            Email *
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ivory/40" />
                            <input
                              {...step1Form.register("email")}
                              type="email"
                              placeholder="you@example.com"
                              className={cn(
                                "w-full h-12 pl-10 pr-4 rounded-lg",
                                "bg-white/5 border border-white/10",
                                "text-ivory placeholder:text-ivory/30",
                                "focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30",
                                "transition-all duration-300",
                                step1Form.formState.errors.email && "border-red-500/50"
                              )}
                            />
                          </div>
                          {step1Form.formState.errors.email && (
                            <p className="text-xs text-red-400">{step1Form.formState.errors.email.message}</p>
                          )}
                        </div>

                        {/* Discord Handle */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-ivory/70 uppercase tracking-wider">
                            Discord Handle *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ivory/40 text-sm">#</span>
                            <input
                              {...step1Form.register("discord_handle")}
                              type="text"
                              placeholder="username"
                              className={cn(
                                "w-full h-12 pl-8 pr-4 rounded-lg",
                                "bg-white/5 border border-white/10",
                                "text-ivory placeholder:text-ivory/30",
                                "focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30",
                                "transition-all duration-300",
                                step1Form.formState.errors.discord_handle && "border-red-500/50"
                              )}
                            />
                          </div>
                          {step1Form.formState.errors.discord_handle && (
                            <p className="text-xs text-red-400">{step1Form.formState.errors.discord_handle.message}</p>
                          )}
                        </div>

                        {/* Next Button */}
                        <button
                          type="submit"
                          className={cn(
                            "w-full h-12 rounded-lg font-semibold",
                            "bg-gradient-to-r from-[#10B981] to-champagne",
                            "text-onyx hover:shadow-[0_0_20px_rgba(16, 185, 129,0.3)]",
                            "flex items-center justify-center gap-2",
                            "transition-all duration-300"
                          )}
                        >
                          Continue
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </motion.form>
                    ) : currentStep === 1 ? (
                      <motion.form
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onSubmit={step2Form.handleSubmit(handleStep2Submit)}
                        className="space-y-6"
                      >
                        {/* Experience Level */}
                        <div className="space-y-3">
                          <label className="text-xs font-medium text-ivory/70 uppercase tracking-wider">
                            Trading Experience *
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            {EXPERIENCE_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => step2Form.setValue("experience_level", option.value)}
                                className={cn(
                                  "p-4 rounded-xl border text-center transition-all duration-300",
                                  step2Form.watch("experience_level") === option.value
                                    ? "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16, 185, 129,0.2)]"
                                    : "bg-white/5 border-white/10 hover:border-white/20"
                                )}
                              >
                                <div className="text-sm font-semibold text-ivory">{option.label}</div>
                                <div className="text-xs text-ivory/50 mt-1">{option.description}</div>
                              </button>
                            ))}
                          </div>
                          {step2Form.formState.errors.experience_level && (
                            <p className="text-xs text-red-400">Please select your experience level</p>
                          )}
                        </div>

                        {/* Account Size */}
                        <div className="space-y-3">
                          <label className="text-xs font-medium text-ivory/70 uppercase tracking-wider">
                            Current Account Size *
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            {ACCOUNT_SIZE_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => step2Form.setValue("account_size", option.value)}
                                className={cn(
                                  "p-4 rounded-xl border text-center transition-all duration-300",
                                  step2Form.watch("account_size") === option.value
                                    ? "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16, 185, 129,0.2)]"
                                    : "bg-white/5 border-white/10 hover:border-white/20"
                                )}
                              >
                                <div className="text-sm font-semibold text-ivory">{option.label}</div>
                                <div className="text-xs text-ivory/50 mt-1">{option.description}</div>
                              </button>
                            ))}
                          </div>
                          {step2Form.formState.errors.account_size && (
                            <p className="text-xs text-red-400">Please select your account size</p>
                          )}
                        </div>

                        {/* Navigation */}
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={goBack}
                            className="flex-1 h-12 rounded-lg font-medium border border-white/10 text-ivory/70 hover:bg-white/5 flex items-center justify-center gap-2 transition-all"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                          </button>
                          <button
                            type="submit"
                            className={cn(
                              "flex-1 h-12 rounded-lg font-semibold",
                              "bg-gradient-to-r from-[#10B981] to-champagne",
                              "text-onyx hover:shadow-[0_0_20px_rgba(16, 185, 129,0.3)]",
                              "flex items-center justify-center gap-2",
                              "transition-all duration-300"
                            )}
                          >
                            Continue
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.form>
                    ) : (
                      <motion.form
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onSubmit={step3Form.handleSubmit(handleFinalSubmit)}
                        className="space-y-5"
                      >
                        {/* Primary Struggle */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-ivory/70 uppercase tracking-wider">
                            Primary Struggle *
                          </label>
                          <select
                            {...step3Form.register("primary_struggle")}
                            className={cn(
                              "w-full h-12 px-4 rounded-lg appearance-none",
                              "bg-white/5 border border-white/10",
                              "text-ivory",
                              "focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30",
                              "transition-all duration-300",
                              step3Form.formState.errors.primary_struggle && "border-red-500/50"
                            )}
                          >
                            <option value="" className="bg-[#0a0a0b]">Select your biggest challenge...</option>
                            {STRUGGLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value} className="bg-[#0a0a0b]">
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {step3Form.formState.errors.primary_struggle && (
                            <p className="text-xs text-red-400">Please select your primary struggle</p>
                          )}
                        </div>

                        {/* Short-term Goal */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-ivory/70 uppercase tracking-wider">
                            What&apos;s your trading goal for the next 12 months? *
                          </label>
                          <div className="relative">
                            <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-ivory/40" />
                            <textarea
                              {...step3Form.register("short_term_goal")}
                              placeholder="Be specific - what does success look like for you?"
                              rows={4}
                              className={cn(
                                "w-full pl-10 pr-4 py-3 rounded-lg resize-none",
                                "bg-white/5 border border-white/10",
                                "text-ivory placeholder:text-ivory/30",
                                "focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30",
                                "transition-all duration-300",
                                step3Form.formState.errors.short_term_goal && "border-red-500/50"
                              )}
                            />
                          </div>
                          {step3Form.formState.errors.short_term_goal && (
                            <p className="text-xs text-red-400">{step3Form.formState.errors.short_term_goal.message}</p>
                          )}
                        </div>

                        {/* Navigation */}
                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={goBack}
                            disabled={isSubmitting}
                            className="flex-1 h-12 rounded-lg font-medium border border-white/10 text-ivory/70 hover:bg-white/5 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className={cn(
                              "flex-1 h-12 rounded-lg font-semibold",
                              "bg-gradient-to-r from-[#10B981] to-champagne",
                              "text-onyx hover:shadow-[0_0_20px_rgba(16, 185, 129,0.3)]",
                              "flex items-center justify-center gap-2",
                              "transition-all duration-300",
                              "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                Get Started
                                <CheckCircle className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                {!isSuccess && (
                  <div className="px-6 pb-6">
                    <p className="text-xs text-center text-ivory/40">
                      Limited to 20 traders per cohort. Applications reviewed within 24-48 hours.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook for managing modal state
export function useCohortApplicationModal() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
