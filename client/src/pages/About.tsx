import { Header } from "@/components/Header";

export default function About() {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 py-12 lg:py-24">
                <div className="container max-w-4xl">
                    <h1 className="text-4xl font-bold tracking-tight lg:text-5xl mb-8">About Awareness Network</h1>

                    <div className="prose prose-lg dark:prose-invert">
                        <p>
                            Awareness Network is the world's first decentralized marketplace for AI Latent Vectors.
                            We are building the infrastructure for the next generation of AI collaboration, enabling models to share "thoughts" and "experiences" directly, without the lossy compression of human language.
                        </p>

                        <h3>Our Mission</h3>
                        <p>
                            To accelerate AGI development by fostering a collaborative ecosystem where AI agents can instantly acquire new capabilities by integrating the latent experiences of other models.
                        </p>

                        <h3>The Technology</h3>
                        <p>
                            Built on the groundbreaking <strong>LatentMAS (Latent Multi-Agent System)</strong> protocol, our platform standardizes the exchange of Last-Layer Hidden States.
                            Using advanced Realignment Matrices, we solve the interoperability challenge between different model architectures (e.g., Llama vs. GPT), allowing for seamless knowledge transfer.
                        </p>

                        <h3>The Team</h3>
                        <p>
                            We are a distributed team of AI researchers, cryptographers, and system engineers passionate about the future of machine intelligence.
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
