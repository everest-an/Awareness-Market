/**
 * Evidence Attachment — DOI lookup, URL input, claim type selection
 *
 * Allows users to attach evidence (citations, DOIs, URLs) to memories
 * for scientific-tier cross-domain verification.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  Link2,
  FileText,
  FlaskConical,
  Cpu,
  Plus,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface EvidenceAttachmentProps {
  memoryId: string;
  orgId: number;
  onAttached?: () => void;
}

const EVIDENCE_TYPES = [
  { value: "arxiv", label: "arXiv Paper", icon: FileText, color: "text-blue-400" },
  { value: "doi", label: "DOI / Journal", icon: BookOpen, color: "text-green-400" },
  { value: "internal_data", label: "Internal Data", icon: FlaskConical, color: "text-purple-400" },
  { value: "experimental", label: "Experimental", icon: FlaskConical, color: "text-orange-400" },
  { value: "computational", label: "Computational", icon: Cpu, color: "text-cyan-400" },
];

const CLAIM_TYPES = [
  { value: "theorem", label: "Theorem" },
  { value: "hypothesis", label: "Hypothesis" },
  { value: "model", label: "Model" },
  { value: "experimental_result", label: "Experimental Result" },
];

export default function EvidenceAttachment({ memoryId, orgId, onAttached }: EvidenceAttachmentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [evidenceType, setEvidenceType] = useState("doi");
  const [claimType, setClaimType] = useState("hypothesis");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceDoi, setSourceDoi] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [unit, setUnit] = useState("");
  const [dimension, setDimension] = useState("");

  const attachMutation = trpc.verification.addEvidence.useMutation({
    onSuccess: () => {
      toast.success("Evidence attached successfully");
      setIsOpen(false);
      resetForm();
      onAttached?.();
    },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  const resetForm = () => {
    setSourceUrl("");
    setSourceDoi("");
    setAssumptions("");
    setUnit("");
    setDimension("");
  };

  const handleSubmit = () => {
    attachMutation.mutate({
      memoryId,
      orgId,
      evidenceType: evidenceType as "arxiv" | "doi" | "internal_data" | "experimental" | "computational" | "url",
      claimType: claimType as "theorem" | "hypothesis" | "model" | "experimental_result",
      sourceUrl: sourceUrl || undefined,
      sourceDoi: sourceDoi || undefined,
      assumptions: assumptions ? assumptions.split("\n").filter(Boolean) : undefined,
      unit: unit || undefined,
      dimension: dimension || undefined,
    });
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-white/[0.12] text-white/30 text-xs hover:border-cyan-500/30 hover:text-cyan-400 transition-all backdrop-blur-sm"
      >
        <Plus className="w-3.5 h-3.5" />
        Attach Evidence
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.1] bg-white/[0.03] backdrop-blur-md p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm text-white font-medium flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          Attach Evidence
        </h4>
        <button type="button" onClick={() => setIsOpen(false)} className="text-white/30 hover:text-white/60">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Evidence Type */}
      <div>
        <label className="text-xs text-white/40 mb-2 block">Evidence Type</label>
        <div className="grid grid-cols-5 gap-2">
          {EVIDENCE_TYPES.map((et) => {
            const Icon = et.icon;
            return (
              <button
                key={et.value}
                type="button"
                onClick={() => setEvidenceType(et.value)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-all ${
                  evidenceType === et.value
                    ? "border-cyan-500/30 bg-cyan-500/[0.08] text-white"
                    : "border-white/[0.08] text-white/40 hover:border-white/15"
                }`}
              >
                <Icon className={`w-4 h-4 ${evidenceType === et.value ? et.color : "text-white/30"}`} />
                {et.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Claim Type */}
      <div>
        <label className="text-xs text-white/40 mb-2 block">Claim Type</label>
        <div className="flex gap-2">
          {CLAIM_TYPES.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => setClaimType(ct.value)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                claimType === ct.value
                  ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                  : "bg-white/[0.04] text-white/40 border border-white/[0.08] hover:border-white/15"
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* URL / DOI */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 mb-1 block flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Source URL
          </label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://arxiv.org/abs/..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-cyan-500/40"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1 block flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> DOI
          </label>
          <input
            type="text"
            value={sourceDoi}
            onChange={(e) => setSourceDoi(e.target.value)}
            placeholder="10.1038/..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-cyan-500/40"
          />
        </div>
      </div>

      {/* Assumptions */}
      <div>
        <label className="text-xs text-white/40 mb-1 block">Assumptions (one per line)</label>
        <textarea
          value={assumptions}
          onChange={(e) => setAssumptions(e.target.value)}
          rows={2}
          placeholder="e.g., Assumes standard temperature and pressure..."
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-cyan-500/40 resize-none"
        />
      </div>

      {/* Unit / Dimension */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 mb-1 block">Unit</label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g., kg/m²"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-cyan-500/40"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1 block">Dimension</label>
          <input
            type="text"
            value={dimension}
            onChange={(e) => setDimension(e.target.value)}
            placeholder="e.g., mass/area"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-cyan-500/40"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={attachMutation.isPending || (!sourceUrl && !sourceDoi)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-sm font-medium hover:bg-cyan-500/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {attachMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        Attach Evidence
      </button>
    </div>
  );
}
