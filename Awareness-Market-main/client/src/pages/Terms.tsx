import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Content */}
      <div className="container py-12 mt-20">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-8 text-4xl font-bold">Terms of Service</h1>
          <p className="mb-8 text-muted-foreground">Last updated: January 1, 2026</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Awareness Network ("the Platform"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">2. Description of Service</h2>
              <p>
                Awareness Network is a marketplace for AI latent space vectors and capabilities. The Platform enables:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Creators to upload, list, and sell AI vectors and capabilities</li>
                <li>Consumers to discover, purchase, and use AI capabilities</li>
                <li>AI agents to autonomously register, transact, and integrate capabilities</li>
                <li>Vector transformation and alignment through LatentMAS protocol</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">3. User Accounts</h2>
              <p>
                To use certain features of the Platform, you must create an account. You are responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
                <li>Ensuring your account information is accurate and up-to-date</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">4. Creator Responsibilities</h2>
              <p>
                If you upload vectors or capabilities to the Platform, you agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Own or have the right to distribute the uploaded content</li>
                <li>Provide accurate descriptions and performance metrics</li>
                <li>Maintain the quality and availability of your vectors</li>
                <li>Comply with all applicable laws and regulations</li>
                <li>Not upload malicious, harmful, or illegal content</li>
                <li>Pay the platform commission (15% of transaction value)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">5. Consumer Responsibilities</h2>
              <p>
                When purchasing and using vectors from the Platform, you agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use purchased vectors in compliance with applicable laws</li>
                <li>Not reverse engineer, redistribute, or resell vectors without permission</li>
                <li>Respect intellectual property rights of creators</li>
                <li>Provide honest reviews and feedback</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">6. Payment Terms</h2>
              <p>
                All payments are processed through Stripe. By making a purchase, you agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate payment information</li>
                <li>Pay all applicable fees and charges</li>
                <li>Accept that prices are subject to change</li>
                <li>Understand that refunds are subject to our refund policy</li>
              </ul>
              <p className="mt-4">
                Platform commission: We charge creators a 15% commission on each transaction. Consumers pay the listed price with no additional fees.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">7. Intellectual Property</h2>
              <p>
                The Platform and its original content, features, and functionality are owned by Awareness Network and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p className="mt-4">
                Creators retain ownership of their uploaded vectors but grant the Platform a license to host, display, and facilitate transactions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">8. Prohibited Activities</h2>
              <p>
                You may not:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violate any laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Upload malicious code or harmful content</li>
                <li>Attempt to gain unauthorized access to the Platform</li>
                <li>Interfere with the proper functioning of the Platform</li>
                <li>Engage in fraudulent activities</li>
                <li>Harass or harm other users</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">9. Content Moderation</h2>
              <p>
                We reserve the right to review, remove, or refuse any content that violates these Terms or is deemed inappropriate. We may suspend or terminate accounts that violate our policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">10. Disclaimers</h2>
              <p>
                THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>The accuracy, reliability, or quality of vectors</li>
                <li>Uninterrupted or error-free service</li>
                <li>That vectors will meet your specific requirements</li>
                <li>The security of data transmission</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">11. Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, AWARENESS NETWORK SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">12. Indemnification</h2>
              <p>
                You agree to indemnify and hold harmless Awareness Network from any claims, damages, losses, or expenses arising from your use of the Platform or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">13. Termination</h2>
              <p>
                We may terminate or suspend your account at any time for violations of these Terms. Upon termination, your right to use the Platform will immediately cease.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">14. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of significant changes. Continued use of the Platform after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">15. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">16. Contact Information</h2>
              <p>
                For questions about these Terms, please contact us at:
              </p>
              <p className="font-medium">
                Email: legal@awareness-network.com<br />
                Address: [Your Address]
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
