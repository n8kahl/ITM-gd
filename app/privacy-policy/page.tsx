import Link from "next/link";
import { GradientMeshBackground } from "@/components/ui/gradient-mesh-background";
import { ContactLink } from "@/components/ui/contact-link";

export const metadata = {
  title: "Privacy Policy - Trade In The Money",
  description: "Privacy Policy for Trade In The Money trading signals and education platform.",
};

export default function PrivacyPolicy() {
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
            <h1 className="text-3xl md:text-4xl font-bold text-gradient-champagne mb-2">Privacy Policy</h1>
            <p className="text-muted-foreground mb-8">Last Updated: January 28, 2026</p>

            <div className="prose prose-invert prose-sm max-w-none space-y-6 text-smoke/80">
              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">1. Introduction</h2>
                <p>
                  Trade In The Money (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">2. Information We Collect</h2>
                <p>We may collect the following types of information:</p>
                <p className="mt-2"><strong className="text-ivory">Personal Information:</strong> Name, email address, and payment information when you subscribe to our services.</p>
                <p className="mt-2"><strong className="text-ivory">Usage Data:</strong> Information about how you access and use our website, including IP address, browser type, pages visited, and time spent on pages.</p>
                <p className="mt-2"><strong className="text-ivory">Communication Data:</strong> Information you provide when you contact us or participate in our Discord community.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">3. How We Use Your Information</h2>
                <p>We use your information to:</p>
                <p className="mt-2">- Provide, maintain, and improve our services</p>
                <p>- Process transactions and send related information</p>
                <p>- Send you trading signals and educational content</p>
                <p>- Respond to your comments, questions, and requests</p>
                <p>- Send promotional communications (with your consent)</p>
                <p>- Monitor and analyze usage patterns and trends</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">4. Information Sharing</h2>
                <p>
                  We do not sell, trade, or rent your personal information to third parties. We may share your information with:
                </p>
                <p className="mt-2"><strong className="text-ivory">Service Providers:</strong> Third-party vendors who help us operate our business (e.g., payment processors like Stripe, platform providers like Whop).</p>
                <p className="mt-2"><strong className="text-ivory">Legal Requirements:</strong> When required by law or to protect our rights and safety.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">5. Data Security</h2>
                <p>
                  We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">6. Your Rights</h2>
                <p>Depending on your location, you may have the right to:</p>
                <p className="mt-2">- Access the personal information we hold about you</p>
                <p>- Request correction of inaccurate data</p>
                <p>- Request deletion of your personal data</p>
                <p>- Opt-out of marketing communications</p>
                <p>- Withdraw consent where processing is based on consent</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">7. Cookies</h2>
                <p>
                  We use cookies and similar tracking technologies to enhance your experience on our website. You can control cookies through your browser settings.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">8. Third-Party Links</h2>
                <p>
                  Our website may contain links to third-party websites. We are not responsible for the privacy practices of these external sites.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">9. Children&apos;s Privacy</h2>
                <p>
                  Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">10. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last Updated&quot; date.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ivory mb-3">11. Contact Us</h2>
                <p>
                  If you have questions about this Privacy Policy, please{" "}
                  <ContactLink className="text-champagne hover:underline">contact us</ContactLink>.
                </p>
              </section>
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
              <Link href="/privacy-policy" className="text-champagne transition-colors duration-300">Privacy Policy</Link>
              <Link href="/terms-of-service" className="hover:text-champagne transition-colors duration-300">Terms of Service</Link>
              <ContactLink className="hover:text-champagne transition-colors duration-300">Contact</ContactLink>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
