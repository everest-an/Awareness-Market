import { Link } from 'wouter';
import { ArrowLeft, ExternalLink, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Navbar from '@/components/Navbar';

export default function BlogLatentMASPaper() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />
      
      <div className="pt-20 container mx-auto px-4 py-16">
        <Link href="/blog">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Button>
        </Link>

        <article className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-cyan-400 mb-4">
              <FileText className="h-4 w-4" />
              <span>Research Paper</span>
              <span>→</span>
              <time dateTime="2024-12-15">December 15, 2024</time>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              LatentMAS: Multi-Agent Collaboration via Latent Space Memory Exchange
            </h1>
            
            <p className="text-xl text-slate-300">
              A groundbreaking research paper introducing a novel framework for AI agent collaboration through compressed latent space representations.
            </p>

            <div className="flex flex-wrap gap-4 mt-6">
              <a
                href="https://arxiv.org/html/2511.20639v2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Read on arXiv
                </Button>
              </a>
              <a
                href="https://arxiv.org/pdf/2511.20639v2.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </a>
            </div>
          </div>

          {/* Abstract */}
          <Card className="p-8 mb-8 bg-slate-900/50 border-slate-800">
            <h2 className="text-2xl font-bold text-white mb-4">Abstract</h2>
            <p className="text-slate-300 leading-relaxed">
              We introduce <strong>LatentMAS</strong> (Latent Multi-Agent System), a novel framework that enables efficient collaboration between AI agents through the exchange of compressed latent space representations rather than traditional natural language communication. By leveraging KV-Cache compression, dynamic W-Matrix alignment, and semantic anchor standardization, LatentMAS achieves up to 95% bandwidth reduction while maintaining high fidelity in inter-agent communication.
            </p>
          </Card>

          {/* Key Contributions */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Key Contributions</h2>
            
            <div className="space-y-6">
              <Card className="p-6 bg-slate-900/50 border-slate-800">
                <h3 className="text-xl font-semibold text-cyan-400 mb-3">
                  1. Symmetric Focus KV-Cache Compression
                </h3>
                <p className="text-slate-300 mb-4">
                  A novel attention-based compression algorithm that selectively transmits only the most important tokens (&gt;90% cumulative attention weight), achieving 95% bandwidth savings without significant information loss.
                </p>
                <div className="bg-slate-950 p-4 rounded-lg">
                  <code className="text-sm text-green-400">
                    compression_ratio = 0.05  # 95% bandwidth reduction<br/>
                    cumulative_attention = 0.95  # Maintains 95% semantic content
                  </code>
                </div>
              </Card>

              <Card className="p-6 bg-slate-900/50 border-slate-800">
                <h3 className="text-xl font-semibold text-cyan-400 mb-3">
                  2. Dynamic W-Matrix with MLP Alignment Head
                </h3>
                <p className="text-slate-300 mb-4">
                  A cross-model vector alignment mechanism using non-linear MLP projection layers, enabling seamless communication between agents using different foundation models (e.g., GPT-4 �?Claude-3 �?LLaMA-3).
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>Adaptive architecture selection based on dimension ratios</li>
                  <li>Learnable transformation paths for optimal alignment</li>
                  <li>Sub-0.01 alignment loss across popular model pairs</li>
                </ul>
              </Card>

              <Card className="p-6 bg-slate-900/50 border-slate-800">
                <h3 className="text-xl font-semibold text-cyan-400 mb-3">
                  3. Proof-of-Latent-Fidelity (PoLF) Protocol
                </h3>
                <p className="text-slate-300 mb-4">
                  An anti-poisoning verification mechanism using challenge-response protocols to detect corrupted or malicious latent vectors before they propagate through the agent network.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="bg-slate-950 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-400">98.7%</div>
                    <div className="text-sm text-slate-400">Detection Rate</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-cyan-400">&lt;0.1%</div>
                    <div className="text-sm text-slate-400">False Positives</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-400">150ms</div>
                    <div className="text-sm text-slate-400">Avg Verification</div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-slate-900/50 border-slate-800">
                <h3 className="text-xl font-semibold text-cyan-400 mb-3">
                  4. Semantic Anchor Standardization
                </h3>
                <p className="text-slate-300 mb-4">
                  A curated set of 1,024 golden anchor prompts across 16 semantic categories, providing a universal reference frame for measuring and calibrating latent vector quality and alignment.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {['Factual Knowledge', 'Logical Reasoning', 'Creative Expression', 'Emotional Intelligence', 'Technical Skills', 'Ethical Judgment', 'Spatial Reasoning', 'Temporal Understanding'].map((category) => (
                    <span key={category} className="px-3 py-1 bg-cyan-900/30 border border-cyan-700/50 rounded-full text-sm text-cyan-300">
                      {category}
                    </span>
                  ))}
                </div>
              </Card>
            </div>
          </section>

          {/* Experimental Results */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Experimental Results</h2>
            
            <Card className="p-8 bg-slate-900/50 border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">Performance Metrics</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-300">Bandwidth Efficiency</span>
                        <span className="text-green-400 font-semibold">95%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '95%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-300">Semantic Fidelity</span>
                        <span className="text-cyan-400 font-semibold">93.2%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div className="bg-cyan-500 h-2 rounded-full" style={{ width: '93.2%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-300">Cross-Model Alignment</span>
                        <span className="text-purple-400 font-semibold">91.8%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: '91.8%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">Comparison vs Baselines</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-950 rounded-lg">
                      <span className="text-slate-300">Natural Language</span>
                      <span className="text-slate-500">1.0x (baseline)</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-950 rounded-lg">
                      <span className="text-slate-300">Raw Embeddings</span>
                      <span className="text-amber-400">3.2x faster</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                      <span className="text-green-300 font-semibold">LatentMAS (Ours)</span>
                      <span className="text-green-400 font-bold">18.7x faster</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* Applications */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Real-World Applications</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 bg-slate-900/50 border-slate-800">
                <h3 className="text-lg font-semibold text-cyan-400 mb-3">Multi-Agent Reasoning</h3>
                <p className="text-slate-300 text-sm">
                  Enable complex problem-solving through collaborative reasoning chains where specialized agents exchange compressed insights.
                </p>
              </Card>

              <Card className="p-6 bg-slate-900/50 border-slate-800">
                <h3 className="text-lg font-semibold text-cyan-400 mb-3">Distributed AI Systems</h3>
                <p className="text-slate-300 text-sm">
                  Build scalable agent networks with efficient inter-node communication, reducing latency and bandwidth costs.
                </p>
              </Card>

              <Card className="p-6 bg-slate-900/50 border-slate-800">
                <h3 className="text-lg font-semibold text-cyan-400 mb-3">Cross-Platform Integration</h3>
                <p className="text-slate-300 text-sm">
                  Connect agents powered by different foundation models (GPT, Claude, LLaMA) in a unified ecosystem.
                </p>
              </Card>

              <Card className="p-6 bg-slate-900/50 border-slate-800">
                <h3 className="text-lg font-semibold text-cyan-400 mb-3">Marketplace Economy</h3>
                <p className="text-slate-300 text-sm">
                  Create tradeable latent memory assets that can be bought, sold, and reused across different applications.
                </p>
              </Card>
            </div>
          </section>

          {/* Citation */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Citation</h2>
            
            <Card className="p-6 bg-slate-900/50 border-slate-800">
              <pre className="text-sm text-slate-300 overflow-x-auto">
{`@article{latentmas2024,
  title={LatentMAS: Multi-Agent Collaboration via Latent Space Memory Exchange},
  author={Awareness Research Team},
  journal={arXiv preprint arXiv:2511.20639},
  year={2024},
  url={https://arxiv.org/html/2511.20639v2}
}`}
              </pre>
            </Card>
          </section>

          {/* Call to Action */}
          <Card className="p-8 bg-gradient-to-br from-cyan-900/20 to-purple-900/20 border-cyan-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">Try LatentMAS v2 Features</h2>
            <p className="text-slate-300 mb-6">
              Experience the power of LatentMAS with our interactive demo showcasing all 4 core v2 enhancements.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/latentmas-v2-demo">
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  Interactive Demo
                </Button>
              </Link>
              <Link href="/docs/sdk">
                <Button variant="outline">
                  SDK Documentation
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline">
                  Explore Marketplace
                </Button>
              </Link>
            </div>
          </Card>
        </article>
      </div>
    </div>
  );
}
