/**
 * Organization Setup — Creation wizard for new AI organizations
 *
 * Step 1: Name & slug
 * Step 2: Plan tier selection
 * Step 3: Initial departments
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import {
  Building2,
  Zap,
  Shield,
  FlaskConical,
  ArrowRight,
  ArrowLeft,
  Check,
  Users,
  Bot,
  Brain,
} from "lucide-react";

const PLAN_TIERS = [
  {
    id: "lite" as const,
    name: "Lite",
    price: "$49/mo",
    agents: "2-8 agents",
    departments: "1 department",
    features: ["Basic organization", "Memory lifecycle", "Scoring engine"],
    icon: Zap,
    color: "cyan",
  },
  {
    id: "team" as const,
    name: "Team",
    price: "$199/mo",
    agents: "8-32 agents",
    departments: "Up to 10",
    features: ["Multi-department", "Decay automation", "Memory pools"],
    icon: Users,
    color: "blue",
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "$499/mo",
    agents: "32-128 agents",
    departments: "Up to 50",
    features: ["Decision audit", "Reputation system", "Compliance export"],
    icon: Shield,
    color: "purple",
  },
  {
    id: "scientific" as const,
    name: "Scientific",
    price: "$999/mo",
    agents: "Unlimited",
    departments: "Up to 200",
    features: ["Cross-domain verification", "Evidence tracking", "Dependency graphs"],
    icon: FlaskConical,
    color: "emerald",
  },
];

export default function OrganizationSetup() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"lite" | "team" | "enterprise" | "scientific">("lite");
  const [error, setError] = useState("");

  const createOrg = trpc.organization.create.useMutation({
    onSuccess: (org) => {
      navigate(`/org/dashboard?id=${org.id}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate slug from name
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 64)
    );
  };

  const handleCreate = () => {
    setError("");
    createOrg.mutate({
      name,
      slug,
      description: description || undefined,
      planTier: selectedPlan,
    });
  };

  const canProceed = step === 1 ? name.trim().length > 0 && slug.length > 0 : true;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-sm mb-4">
            <Building2 className="w-4 h-4" />
            Create AI Organization
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Set Up Your AI Organization
          </h1>
          <p className="text-white/50">
            Organize your AI agents into departments with shared memory and governance
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step >= s
                    ? "bg-cyan-500 text-white"
                    : "bg-white/[0.06] text-white/30 border border-white/[0.1]"
                }`}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={`text-sm ${step >= s ? "text-white" : "text-white/30"}`}>
                {s === 1 ? "Organization Info" : "Select Plan"}
              </span>
              {s < 2 && (
                <div className={`w-16 h-px ${step > s ? "bg-cyan-500" : "bg-white/[0.1]"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Organization Info */}
        {step === 1 && (
          <div className="glass-card p-8 space-y-6">
            <div>
              <label className="block text-sm text-white/70 mb-2">Organization Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Acme AI Research Lab"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">URL Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-white/30 text-sm">awareness.network/org/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="acme-ai"
                  className="flex-1 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">
                Description <span className="text-white/20">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does your AI organization do?"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 2: Plan Selection */}
        {step === 2 && (
          <div className="grid md:grid-cols-2 gap-4">
            {PLAN_TIERS.map((plan) => {
              const Icon = plan.icon;
              const isSelected = selectedPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`glass-card p-6 text-left transition-all ${
                    isSelected
                      ? `border-${plan.color}-500/50 bg-${plan.color}-500/[0.08]`
                      : "hover:bg-white/[0.04]"
                  }`}
                  style={
                    isSelected
                      ? { borderColor: `var(--color-${plan.color}-500, rgba(6,182,212,0.5))` }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg bg-${plan.color}-500/10`}>
                      <Icon className={`w-5 h-5 text-${plan.color}-400`} />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{plan.name}</h3>
                      <p className="text-cyan-400 text-lg font-bold">{plan.price}</p>
                    </div>
                    {isSelected && (
                      <div className="ml-auto">
                        <Check className="w-5 h-5 text-cyan-400" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-sm text-white/50">
                    <div className="flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5" /> {plan.agents}
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5" /> {plan.departments}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-xs text-white/40">
                        <Check className="w-3 h-3 text-cyan-500/60" />
                        {f}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => step > 1 && setStep(step - 1)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all ${
              step > 1
                ? "text-white/70 hover:text-white hover:bg-white/[0.06]"
                : "text-white/20 cursor-not-allowed"
            }`}
            disabled={step <= 1}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {step < 2 ? (
            <button
              onClick={() => canProceed && setStep(step + 1)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                canProceed
                  ? "bg-cyan-500 text-white hover:bg-cyan-400"
                  : "bg-white/[0.06] text-white/30 cursor-not-allowed"
              }`}
              disabled={!canProceed}
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={createOrg.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-400 transition-all disabled:opacity-50"
            >
              {createOrg.isPending ? (
                <>
                  <Brain className="w-4 h-4 animate-pulse" /> Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Create Organization
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
