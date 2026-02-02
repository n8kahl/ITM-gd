"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScreenshotWrapper } from "./screenshot-wrapper"
import { ImageIcon, Wand2, CreditCard, TrendingUp } from "lucide-react"

interface StudioTabsProps {
  isAdmin: boolean
}

export function StudioTabs({ isAdmin }: StudioTabsProps) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-serif text-white">Media Command Studio</h1>
        <p className="text-lg text-white/60">
          Generate viral trading content with TradeITM branding.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="wrapper" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="wrapper">
            <ImageIcon className="w-4 h-4 mr-2" />
            Screenshot Framer
          </TabsTrigger>

          {/* Placeholder tabs for future modes */}
          <TabsTrigger value="win-cards" disabled>
            <Wand2 className="w-4 h-4 mr-2" />
            Re-Printer
            <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded">Soon</span>
          </TabsTrigger>

          <TabsTrigger value="passport" disabled>
            <CreditCard className="w-4 h-4 mr-2" />
            Passport
            <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded">Soon</span>
          </TabsTrigger>

          {isAdmin && (
            <TabsTrigger value="pulse" disabled>
              <TrendingUp className="w-4 h-4 mr-2" />
              The Pulse
              <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded">Soon</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="wrapper" className="space-y-6">
          <ScreenshotWrapper />
        </TabsContent>

        {/* Future tab contents will go here */}
        <TabsContent value="win-cards">
          <div className="glass-card-heavy p-12 rounded-2xl text-center border border-white/10">
            <Wand2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-2xl font-serif text-white mb-2">Re-Printer Coming Soon</h3>
            <p className="text-white/60">
              Generate clean win cards from manual entry or AI screenshot extraction.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="passport">
          <div className="glass-card-heavy p-12 rounded-2xl text-center border border-white/10">
            <CreditCard className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-2xl font-serif text-white mb-2">Member Passport Coming Soon</h3>
            <p className="text-white/60">
              Auto-generated identity cards with your stats, tier, and achievements.
            </p>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="pulse">
            <div className="glass-card-heavy p-12 rounded-2xl text-center border border-white/10">
              <TrendingUp className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-2xl font-serif text-white mb-2">Community Pulse Coming Soon</h3>
              <p className="text-white/60">
                Admin-only: Generate social proof graphics with aggregated ticker stats.
              </p>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
