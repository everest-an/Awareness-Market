/**
 * Department Manager — CRUD component with tree hierarchy display
 *
 * Features:
 * - Create/edit/delete departments
 * - Tree hierarchy visualization
 * - Default memory type & decay settings per department
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit3,
  X,
  Check,
  Layers,
  Brain,
} from "lucide-react";

interface DepartmentManagerProps {
  orgId: number;
  maxDepartments: number;
}

const MEMORY_TYPES = [
  { id: "episodic", label: "Episodic", decay: "0.05", desc: "Short-term events (~14 days)" },
  { id: "semantic", label: "Semantic", decay: "0.01", desc: "General knowledge (~70 days)" },
  { id: "strategic", label: "Strategic", decay: "0.001", desc: "Long-term decisions (~693 days)" },
  { id: "procedural", label: "Procedural", decay: "0.02", desc: "Process/how-to (~35 days)" },
];

export default function DepartmentManager({ orgId, maxDepartments }: DepartmentManagerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newMemoryType, setNewMemoryType] = useState("semantic");
  const [newParentId, setNewParentId] = useState<number | undefined>();
  const [error, setError] = useState("");

  const utils = trpc.useUtils();

  const { data: deptTree, isLoading } = trpc.organization.getDepartmentTree.useQuery({ orgId });
  const { data: flatDepts } = trpc.organization.listDepartments.useQuery({ orgId });

  const createDept = trpc.organization.createDepartment.useMutation({
    onSuccess: () => {
      utils.organization.getDepartmentTree.invalidate({ orgId });
      utils.organization.listDepartments.invalidate({ orgId });
      utils.organization.get.invalidate({ orgId });
      setShowCreate(false);
      setNewName("");
      setNewSlug("");
      setNewDesc("");
      setNewMemoryType("semantic");
      setNewParentId(undefined);
      setError("");
    },
    onError: (err) => setError(err.message),
  });

  const deleteDept = trpc.organization.deleteDepartment.useMutation({
    onSuccess: () => {
      utils.organization.getDepartmentTree.invalidate({ orgId });
      utils.organization.listDepartments.invalidate({ orgId });
      utils.organization.get.invalidate({ orgId });
    },
  });

  const handleNameChange = (value: string) => {
    setNewName(value);
    setNewSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
    );
  };

  const handleCreate = () => {
    setError("");
    createDept.mutate({
      organizationId: orgId,
      name: newName,
      slug: newSlug,
      description: newDesc || undefined,
      defaultMemoryType: newMemoryType as any,
      parentDeptId: newParentId,
    });
  };

  const totalDepts = flatDepts?.length || 0;
  const canCreate = totalDepts < maxDepartments;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-white font-semibold">
          Departments ({totalDepts}/{maxDepartments})
        </h2>
        {canCreate && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all text-sm"
          >
            {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showCreate ? "Cancel" : "New Department"}
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm text-white/50 uppercase tracking-wider">
            Create Department
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Engineering"
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Slug</label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="engineering"
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Description (optional)</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What does this department do?"
              className="w-full px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Parent Department</label>
              <select
                value={newParentId || ""}
                onChange={(e) => setNewParentId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white text-sm focus:outline-none focus:border-cyan-500/50"
              >
                <option value="">None (root department)</option>
                {flatDepts?.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Default Memory Type</label>
              <select
                value={newMemoryType}
                onChange={(e) => setNewMemoryType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white text-sm focus:outline-none focus:border-cyan-500/50"
              >
                {MEMORY_TYPES.map((mt) => (
                  <option key={mt.id} value={mt.id}>
                    {mt.label} — {mt.desc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={!newName.trim() || !newSlug.trim() || createDept.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            {createDept.isPending ? "Creating..." : "Create Department"}
          </button>
        </div>
      )}

      {/* Department Tree */}
      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <Brain className="w-8 h-8 text-white/20 animate-pulse mx-auto mb-3" />
          <p className="text-white/40 text-sm">Loading departments...</p>
        </div>
      ) : deptTree && deptTree.length > 0 ? (
        <div className="glass-card divide-y divide-white/[0.04]">
          {deptTree.map((dept: any) => (
            <DeptTreeNode
              key={dept.id}
              dept={dept}
              depth={0}
              onDelete={(id) => deleteDept.mutate({ deptId: id })}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <Building2 className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No departments yet</p>
          <p className="text-white/20 text-xs mt-1">
            Create your first department to organize AI agents
          </p>
        </div>
      )}
    </div>
  );
}

// ---- Recursive Tree Node ----

function DeptTreeNode({
  dept,
  depth,
  onDelete,
}: {
  dept: any;
  depth: number;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = dept.children && dept.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => hasChildren && setExpanded(!expanded)}
          className={`w-5 h-5 flex items-center justify-center ${
            hasChildren ? "text-white/40 hover:text-white/70" : "text-transparent"
          }`}
        >
          {hasChildren &&
            (expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            ))}
        </button>

        {/* Icon */}
        <div className="p-1.5 rounded-lg bg-blue-500/10">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium truncate">{dept.name}</div>
          {dept.description && (
            <div className="text-xs text-white/30 truncate">{dept.description}</div>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/20 px-2 py-0.5 rounded bg-white/[0.04]">
            {dept.defaultMemoryType || "semantic"}
          </span>
          <span className="text-xs text-white/30">
            {dept._count?.agentAssignments || 0} agents
          </span>
          <button
            onClick={() => onDelete(dept.id)}
            className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Children */}
      {expanded &&
        hasChildren &&
        dept.children.map((child: any) => (
          <DeptTreeNode
            key={child.id}
            dept={child}
            depth={depth + 1}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}
