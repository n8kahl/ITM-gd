/**
 * Luxury Design System Tokens
 *
 * Centralized Tailwind class strings for consistent styling across the application.
 * Use these tokens instead of hardcoding classes to maintain the "Quiet Luxury" aesthetic.
 */

// Glass Card Styles
export const GLASS_CARD = "bg-[#0F0F10]/60 backdrop-blur-xl border border-white/5 shadow-2xl"
export const GLASS_CARD_HEAVY = "bg-[#0F0F10]/80 backdrop-blur-2xl border border-white/8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
export const GLASS_CARD_LIGHT = "bg-white/3 backdrop-blur-lg border border-white/10"

// Text Gradients
export const GOLD_TEXT = "bg-gradient-to-r from-[#D4AF37] to-[#F1E5AC] bg-clip-text text-transparent"
export const PLATINUM_TEXT = "bg-gradient-to-r from-[#E5E4E2] to-[#F5F5F0] bg-clip-text text-transparent"
export const EMERALD_TEXT = "bg-gradient-to-r from-[#059669] to-[#10B981] bg-clip-text text-transparent"

// Hover Effects
export const HOVER_GLOW = "transition-all duration-300 hover:shadow-[0_0_20px_-5px_rgba(212,175,55,0.3)] hover:border-emerald-500/30"
export const HOVER_LIFT = "transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl"
export const HOVER_GLOW_EMERALD = "transition-all duration-300 hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] hover:border-emerald-500/30"

// Borders
export const BORDER_LUXURY = "border border-white/10 hover:border-emerald-500/20 transition-colors"
export const BORDER_GOLD = "border border-[#D4AF37]/15 hover:border-[#D4AF37]/25 transition-colors"
export const BORDER_PLATINUM = "border border-[#E5E4E2]/15 hover:border-[#E5E4E2]/25 transition-colors"
export const BORDER_HOLOGRAPHIC = "border border-white/10 hover:border-emerald-500/30 transition-all duration-500"

// Backgrounds
export const BG_OBSIDIAN = "bg-[#050505]"
export const BG_OBSIDIAN_CARD = "bg-[#0F0F10]"
export const BG_NOISE = "relative before:absolute before:inset-0 before:opacity-[0.035] before:pointer-events-none before:bg-noise"

// Buttons
export const BTN_CHAMPAGNE = "bg-gradient-to-r from-[#D4AF37] to-emerald-600 text-black font-medium hover:shadow-[0_0_30px_-10px_rgba(212,175,55,0.5)] transition-all duration-300"
export const BTN_GLASS = "bg-white/5 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
export const BTN_EMERALD = "bg-gradient-to-r from-[#059669] to-[#10B981] text-white font-medium hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.5)] transition-all duration-300"

// Input Fields
export const INPUT_LUXURY = "bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500 focus:bg-white/10 focus:outline-none transition-all duration-300 h-12"
export const INPUT_GLASS = "bg-[#0F0F10]/60 backdrop-blur-lg border border-white/8 text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:outline-none transition-all duration-300 h-12"

// Typography
export const HEADING_LUXURY = "font-serif text-[#E5E4E2] tracking-tight"
export const TEXT_MUTED = "text-white/60"
export const TEXT_SUBTLE = "text-white/40"

// Status Colors
export const STATUS_SUCCESS = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
export const STATUS_WARNING = "text-amber-500 bg-amber-500/10 border-amber-500/20"
export const STATUS_ERROR = "text-red-500 bg-red-500/10 border-red-500/20"
export const STATUS_INFO = "text-[#D4AF37] bg-emerald-500/10 border-emerald-500/20"

// Animations
export const ANIMATE_PULSE_GOLD = "animate-pulse-subtle shadow-[0_0_30px_rgba(212,175,55,0.1)]"
export const ANIMATE_PULSE_EMERALD = "animate-pulse-emerald shadow-[0_0_30px_rgba(16,185,129,0.1)]"
export const ANIMATE_FADE_IN = "animate-in fade-in slide-in-from-bottom-4 duration-700"

// Utility Combinations
export const CARD_PREMIUM = `${GLASS_CARD_HEAVY} ${BORDER_LUXURY} ${HOVER_LIFT} rounded-xl p-6`
export const SECTION_CONTAINER = "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
export const FOCUS_RING_GOLD = "focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-[#050505]"
