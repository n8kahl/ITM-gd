import Link from "next/link";
import type { Metadata } from 'next'
import { GradientMeshBackground } from "@/components/ui/gradient-mesh-background";
import { ContactLink } from "@/components/ui/contact-link";

export const metadata: Metadata = {
  title: "Terms of Service - Trade In The Money",
  description: "Terms of Service for Trade In The Money trading signals and education platform.",
  alternates: {
    canonical: '/terms-of-service',
  },
};

export default function TermsOfService() {
  return (
    <main className="min-h-screen relative">
      <GradientMeshBackground />

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Back Link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-champagne hover:text-champagne/80 transition-colors mb-8"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>

          <div className="glass-card-heavy rounded-2xl border border-champagne/20 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-gradient-champagne mb-2">Terms of Service</h1>
            <p className="text-muted-foreground mb-8">Last Updated: January 28, 2026</p>

            <div className="prose prose-invert prose-sm max-w-none space-y-6 text-smoke/80">
              {/* Important Disclaimer Box */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-8">
                <h2 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  IMPORTANT RISK DISCLAIMER
                </h2>
                <p className="text-red-300/90 text-sm leading-relaxed">
                  <strong>TRADING INVOLVES SUBSTANTIAL RISK OF LOSS.</strong> Trading options, stocks, and other financial instruments carries a high level of risk and may not be suitable for all investors. You could lose some or all of your invested capital. Past performance is not indicative of future results. The information provided by Trade In The Money is for educational and informational purposes only and should not be construed as personalized investment advice.
                </p>
              </div>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">1. Acceptance of Terms</h2>
                <p>
                  By accessing or using Trade In The Money (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">2. NOT FINANCIAL ADVICE</h2>
                <p className="font-semibold text-amber-400">
                  THE CONTENT PROVIDED BY TRADE IN THE MONEY IS FOR EDUCATIONAL AND INFORMATIONAL PURPOSES ONLY.
                </p>
                <p className="mt-3">
                  We are NOT registered investment advisors, broker-dealers, or financial planners. Our trading signals, analysis, educational content, and any other information provided:
                </p>
                <p className="mt-2">- Do NOT constitute personalized investment advice</p>
                <p>- Do NOT constitute recommendations to buy, sell, or hold any securities</p>
                <p>- Should NOT be the sole basis for any investment decisions</p>
                <p>- Are NOT tailored to your individual financial situation, objectives, or risk tolerance</p>
                <p className="mt-3">
                  You acknowledge that you are solely responsible for your own investment decisions and that you should consult with a licensed financial advisor before making any investment decisions.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">3. Risk Acknowledgment</h2>
                <p>By using our Service, you acknowledge and agree that:</p>
                <p className="mt-2">- Trading involves substantial risk of loss and is not appropriate for everyone</p>
                <p>- You could lose more than your initial investment</p>
                <p>- Past performance does not guarantee future results</p>
                <p>- You are trading at your own risk and are solely responsible for any losses</p>
                <p>- Any trade signals or ideas shared are for educational purposes and not trade recommendations</p>
                <p>- Market conditions can change rapidly, and timing of signals may not be suitable for all situations</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">4. Limitation of Liability</h2>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRADE IN THE MONEY AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
                </p>
                <p className="mt-2">- Loss of profits, revenue, or anticipated savings</p>
                <p>- Trading losses or investment losses</p>
                <p>- Loss of data or business interruption</p>
                <p>- Any other losses arising from your use of or reliance on the Service</p>
                <p className="mt-3">
                  Our total liability shall not exceed the amount you paid for the Service in the twelve (12) months preceding the claim.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">5. Money-Back Guarantee Terms</h2>
                <p>
                  Our 30-day money-back guarantee is subject to the following conditions:
                </p>
                <p className="mt-2">- You must have followed our signals as instructed during the 30-day period</p>
                <p>- You must provide documentation of your trades upon request</p>
                <p>- The guarantee applies to subscription fees only, not trading losses</p>
                <p>- Refund requests must be submitted within 30 days of purchase</p>
                <p>- We reserve the right to verify compliance with signal following before issuing refunds</p>
                <p className="mt-3">
                  The money-back guarantee does not guarantee trading profits. It is a satisfaction guarantee for our service quality.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">6. User Responsibilities</h2>
                <p>You agree to:</p>
                <p className="mt-2">- Conduct your own research and due diligence before making any trades</p>
                <p>- Not rely solely on our signals or content for investment decisions</p>
                <p>- Understand the risks associated with trading before participating</p>
                <p>- Only trade with capital you can afford to lose</p>
                <p>- Comply with all applicable laws and regulations in your jurisdiction</p>
                <p>- Not share or redistribute our proprietary trading signals or content</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">7. Intellectual Property</h2>
                <p>
                  All content, including trading signals, analysis, educational materials, graphics, and software, is the property of Trade In The Money and is protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written consent.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">8. Subscription and Payments</h2>
                <p className="mt-2">- Subscriptions are billed on a recurring basis according to your selected plan</p>
                <p>- You may cancel your subscription at any time through your Whop account</p>
                <p>- Refunds are subject to our money-back guarantee policy</p>
                <p>- We reserve the right to modify pricing with 30 days notice</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">9. Community Guidelines</h2>
                <p>When participating in our Discord community, you agree not to:</p>
                <p className="mt-2">- Share false or misleading information</p>
                <p>- Harass, threaten, or abuse other members</p>
                <p>- Promote competing services or spam</p>
                <p>- Share copyrighted content without permission</p>
                <p>- Violate any applicable laws or regulations</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">10. Termination</h2>
                <p>
                  We reserve the right to terminate or suspend your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service will immediately cease.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">11. Indemnification</h2>
                <p>
                  You agree to indemnify and hold harmless Trade In The Money, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the Service or violation of these Terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">12. Governing Law</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">13. Changes to Terms</h2>
                <p>
                  We reserve the right to modify these Terms at any time. We will provide notice of significant changes by posting the updated Terms on our website. Your continued use of the Service constitutes acceptance of the modified Terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">14. Contact Information</h2>
                <p>
                  For questions about these Terms of Service, please{" "}
                  <ContactLink className="text-champagne hover:underline">contact us</ContactLink>.
                </p>
              </section>

              {/* Final Acknowledgment */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 mt-8">
                <p className="text-amber-300/90 text-sm leading-relaxed">
                  <strong>BY USING OUR SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE, INCLUDING THE RISK DISCLAIMERS AND LIMITATION OF LIABILITY PROVISIONS.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-champagne/10 bg-[rgba(10,10,11,0.9)] backdrop-blur-xl relative z-10">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="font-serif text-xl tracking-tight font-semibold text-ivory">Trade</span>
                <span className="font-serif text-xl tracking-tight font-semibold text-champagne">ITM</span>
                <span className="w-1.5 h-1.5 rounded-full bg-wealth-emerald ml-0.5 mb-2" />
              </div>
              <div className="ml-2">
                <div className="text-xs text-muted-foreground">&copy; 2026 All rights reserved</div>
              </div>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/privacy-policy" className="hover:text-champagne transition-colors duration-300">Privacy Policy</Link>
              <Link href="/terms-of-service" className="text-champagne transition-colors duration-300">Terms of Service</Link>
              <ContactLink className="hover:text-champagne transition-colors duration-300">Contact</ContactLink>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
