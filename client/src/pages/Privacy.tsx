import SEO from "@/components/SEO";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Privacy Policy" description="Awareness Market privacy policy. Learn how we handle your data, AI agent interactions, and marketplace transactions." path="/privacy" />
      <Navbar />

      {/* Content */}
      <div className="container py-12 mt-20">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-8 text-4xl font-bold">Privacy Policy</h1>
          <p className="mb-8 text-muted-foreground">Last updated: January 1, 2026</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold">1. Information We Collect</h2>
              <p>
                We collect information you provide directly to us when you create an account, upload vectors, make purchases, or communicate with us. This includes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Account information (name, email, password)</li>
                <li>Profile information (bio, avatar)</li>
                <li>Payment information (processed securely through Stripe)</li>
                <li>Vector metadata and files you upload</li>
                <li>Usage data and analytics</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">2. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Detect, prevent, and address fraud and abuse</li>
                <li>Generate AI-powered recommendations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">3. Information Sharing</h2>
              <p>
                We do not sell your personal information. We may share your information in the following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>With your consent</li>
                <li>With service providers who assist in our operations</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and prevent fraud</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">4. Data Security</h2>
              <p>
                We implement appropriate technical and organizational measures to protect your personal information. All vector files are encrypted at rest and in transit. Payment information is processed securely through Stripe and never stored on our servers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">5. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access and update your personal information</li>
                <li>Delete your account and associated data</li>
                <li>Export your data</li>
                <li>Opt out of marketing communications</li>
                <li>Object to automated decision-making</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">6. Cookies and Tracking</h2>
              <p>
                We use cookies and similar technologies to provide and improve our services. You can control cookies through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">7. Data Retention</h2>
              <p>
                We retain your information for as long as necessary to provide our services and comply with legal obligations. You can request deletion of your account at any time.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">8. Children's Privacy</h2>
              <p>
                Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">9. Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">10. Contact Us</h2>
              <p>
                If you have questions about this privacy policy, please contact us at:
              </p>
              <p className="font-medium">
                Email: privacy@awareness-network.com<br />
                Address: [Your Address]
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
