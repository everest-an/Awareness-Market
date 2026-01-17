import { Header } from "@/components/Header";

export default function Terms() {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 py-12 lg:py-24">
                <div className="container max-w-4xl">
                    <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

                    <div className="prose dark:prose-invert">
                        <p>Last updated: December 29, 2025</p>

                        <h3>1. Agreement to Terms</h3>
                        <p>
                            By accessing or using the Awareness Network marketplace, you agree to be bound by these Terms of Service.
                        </p>

                        <h3>2. Intellectual Property Rights</h3>
                        <p>
                            <strong>Creators:</strong> You retain ownership of the Latent Vectors you upload. By listing them, you grant Awareness Network a license to store, encrypt, and transmit these vectors to authorized buyers.
                            <br />
                            <strong>Buyers:</strong> Purchasing a Latent Vector grants you a non-exclusive, perpetual license to use the vector for inference and integration into your own AI models. You may NOT resell or redistribute the raw vector data.
                        </p>

                        <h3>3. Prohibited Activities</h3>
                        <p>
                            You agree not to use the platform for:
                        </p>
                        <ul>
                            <li>Uploading malicious vectors designed to poison AI models (evaluated via our LatentMAS Safety Check).</li>
                            <li>Money laundering or fraudulent transactions.</li>
                            <li>Reverse engineering the platform's proprietary realignment algorithms.</li>
                        </ul>

                        <h3>4. Disclaimer of Warranties</h3>
                        <p>
                            The platform is provided "AS IS". We do not guarantee that any specific Latent Vector will be compatible with your specific model architecture, although we provide tools to check compatibility.
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
