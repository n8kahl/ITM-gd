import Link from "next/link";
import type { Metadata } from 'next'
import { GradientMeshBackground } from "@/components/ui/gradient-mesh-background";
import { ContactLink } from "@/components/ui/contact-link";

export const metadata: Metadata = {
  title: "Refund Policy - Trade In The Money",
  description: "Refund Policy for Trade In The Money memberships and mentorship programs.",
  alternates: {
    canonical: '/refund-policy',
  },
};

export default function RefundPolicy() {
  return (
    <main className="min-h-screen relative">
      <GradientMeshBackground />

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="max-w-4xl mx-auto">
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
            <h1 className="text-3xl md:text-4xl font-bold text-gradient-champagne mb-2">Refund Policy</h1>
            <p className="text-muted-foreground mb-8">Last Updated: February 16, 2026</p>

            <div className="prose prose-invert prose-sm max-w-none space-y-6 text-smoke/80">
              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">1. Policy Scope</h2>
                <p>
                  This Refund Policy applies to Trade In The Money subscriptions, mentorship programs, and related services purchased through our official checkout providers.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">2. General Rule</h2>
                <p>
                  All sales are final. To the maximum extent permitted by law, Trade In The Money is not obligated to provide refunds under any circumstances.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">3. No Refund Obligation</h2>
                <p>Refunds are not required and are not guaranteed for any reason, including:</p>
                <p className="mt-2">- Duplicate or disputed charges</p>
                <p>- Technical-access issues</p>
                <p>- Dissatisfaction with product, signals, coaching, or outcomes</p>
                <p className="mt-3">
                  Any exception, if offered, is a one-time discretionary business decision and does not establish a right or precedent.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">4. Non-Refundable Situations</h2>
                <p>The following do not qualify for refunds:</p>
                <p className="mt-2">- Trading losses or market performance outcomes</p>
                <p>- Dissatisfaction based on expected profit results</p>
                <p>- Failure to follow guidance or risk-management processes</p>
                <p>- Partial use of a subscription period after access has been delivered</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">5. Mentorship Program Terms</h2>
                <p>
                  Precision Cohort is a fixed 90-day program and Private 1-on-1 mentorship is a fixed 8-week program. Both are non-refundable, do not auto-renew unless explicitly stated at checkout, and carry no refund obligation.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">6. Billing Disputes</h2>
                <p>If you need account or billing support, please provide:</p>
                <p className="mt-2">- Full name and purchase email</p>
                <p>- Date of purchase and transaction reference</p>
                <p>- Clear explanation of the billing or access issue</p>
                <p className="mt-3">
                  Submit requests through{" "}
                  <ContactLink className="text-champagne hover:underline">our contact channel</ContactLink>.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">7. Chargebacks</h2>
                <p>
                  We encourage contacting our support team before initiating a chargeback so we can resolve issues directly and quickly.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">8. Changes to This Policy</h2>
                <p>
                  We may update this Refund Policy periodically. Continued use of our services after updates constitutes acceptance of the revised policy.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>

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
              <Link href="/terms-of-service" className="hover:text-champagne transition-colors duration-300">Terms of Service</Link>
              <Link href="/refund-policy" className="text-champagne transition-colors duration-300">Refund Policy</Link>
              <ContactLink className="hover:text-champagne transition-colors duration-300">Contact</ContactLink>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
