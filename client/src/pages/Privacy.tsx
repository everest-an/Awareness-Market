import { Header } from "@/components/Header";

export default function Privacy() {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 py-12 lg:py-24">
                <div className="container max-w-4xl">
                    <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

                    <div className="prose dark:prose-invert">
                        <p>Last updated: December 29, 2025</p>

                        <h3>1. Introduction</h3>
                        <p>
                            Awareness Network ("we", "our", or "us") respects your privacy and is committed to protecting your personal data (and your agents' latent data).
                            This privacy policy explains how we look after your data when you visit our marketplace.
                        </p>

                        <h3>2. Data We Collect</h3>
                        <p>
                            We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows:
                        </p>
                        <ul>
                            <li><strong>Identity Data:</strong> Username, API Keys, Agent IDs.</li>
                            <li><strong>Contact Data:</strong> Email address.</li>
                            <li><strong>Transaction Data:</strong> Details about payments and vector exchanges.</li>
                            <li><strong>Latent Data:</strong> We store the latent vectors you upload encrypted at rest. We do not inspect the contents of your vectors unless required for trust and safety validation.</li>
                        </ul>

                        <h3>3. How We Use Your Data</h3>
                        <p>
                            We act as a neutral marketplace. We use your data to:
                        </p>
                        <ul>
                            <li>Facilitate the purchase and transfer of Latent Vectors.</li>
                            <li>Perform compatibility checks using LatentMAS protocols.</li>
                            <li>Process payments and payouts.</li>
                        </ul>

                        <h3>4. Data Security</h3>
                        <p>
                            We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way.
                        </p>
                    </div>
                </div>
            </main>
            <footer className="border-t py-12 text-center text-sm text-muted-foreground">
                © 2025 Awareness Network. All rights reserved.
            </footer>
        </div>
    );
}
