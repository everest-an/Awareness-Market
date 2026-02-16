/**
 * Report Exporter — Export decision audit reports as CSV
 *
 * Generates exportable reports for compliance and audit purposes.
 * Decisions are immutable, so exports are point-in-time accurate.
 */

import type { PrismaClient } from '@prisma/client';

export class ReportExporter {
  constructor(private prisma: PrismaClient) {}

  /**
   * Export decisions as CSV string
   */
  async exportDecisionsCSV(orgId: number, options?: {
    agentId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<string> {
    const { agentId, startDate, endDate, limit = 1000 } = options || {};

    const where: any = { organizationId: orgId };
    if (agentId) where.agentId = agentId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const decisions = await this.prisma.decision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // CSV header
    const headers = [
      'Decision ID',
      'Agent ID',
      'Department ID',
      'Input Query',
      'Output',
      'Confidence',
      'Memories Used',
      'Tokens Used',
      'Decision Type',
      'Model Used',
      'Latency (ms)',
      'Verified',
      'Correct',
      'Outcome Notes',
      'Created At',
      'Verified At',
    ];

    const rows = decisions.map((d) => [
      d.id,
      d.agentId,
      d.departmentId || '',
      `"${(d.inputQuery || '').replace(/"/g, '""')}"`,
      `"${(d.output || '').replace(/"/g, '""').substring(0, 500)}"`,
      Number(d.confidence),
      (d.retrievedMemoryIds || []).length,
      d.totalTokensUsed,
      d.decisionType || '',
      d.modelUsed || '',
      d.latencyMs || '',
      d.outcomeVerified,
      d.outcomeCorrect ?? '',
      `"${(d.outcomeNotes || '').replace(/"/g, '""')}"`,
      d.createdAt.toISOString(),
      d.verifiedAt?.toISOString() || '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Export agent reputation report as CSV
   */
  async exportReputationCSV(orgId: number): Promise<string> {
    const reputations = await this.prisma.agentReputation.findMany({
      where: { organizationId: orgId },
      orderBy: { overallReputation: 'desc' },
    });

    const headers = [
      'Agent ID',
      'Department ID',
      'Overall Reputation',
      'Write Quality',
      'Decision Accuracy',
      'Collaboration Score',
      'Domain Expertise',
      'Total Writes',
      'Validated Writes',
      'Conflicted Writes',
      'Total Decisions',
      'Correct Decisions',
      'Total Collaborations',
      'Last Active',
    ];

    const rows = reputations.map((r) => [
      r.agentId,
      r.departmentId || 'org-wide',
      Number(r.overallReputation),
      Number(r.writeQuality),
      Number(r.decisionAccuracy),
      Number(r.collaborationScore),
      Number(r.domainExpertise),
      r.totalWrites,
      r.validatedWrites,
      r.conflictedWrites,
      r.totalDecisions,
      r.correctDecisions,
      r.totalCollaborations,
      r.lastActiveAt.toISOString(),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Export memory health report as CSV
   */
  async exportMemoryHealthCSV(orgId: number, limit: number = 5000): Promise<string> {
    const memories = await this.prisma.memoryEntry.findMany({
      where: { organizationId: orgId, isLatest: true },
      include: { score: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const headers = [
      'Memory ID',
      'Content (truncated)',
      'Pool Type',
      'Memory Type',
      'Department',
      'Agent ID',
      'Confidence',
      'Base Score',
      'Final Score',
      'Usage Count',
      'Validation Count',
      'Created At',
    ];

    const rows = memories.map((m) => [
      m.id,
      `"${(m.content || '').replace(/"/g, '""').substring(0, 200)}"`,
      m.poolType,
      m.memoryType,
      m.department || '',
      m.agentId || '',
      Number(m.confidence),
      m.score ? Number(m.score.baseScore) : '',
      m.score ? Number(m.score.finalScore) : '',
      m.usageCount,
      m.validationCount,
      m.createdAt.toISOString(),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Export decisions as styled HTML suitable for PDF rendering.
   * Client can use window.print() or html2pdf.js to generate PDF.
   */
  async exportDecisionsPDFHtml(orgId: number, options?: {
    agentId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    orgName?: string;
  }): Promise<string> {
    const { agentId, startDate, endDate, limit = 500, orgName = 'Organization' } = options || {};

    const where: any = { organizationId: orgId };
    if (agentId) where.agentId = agentId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const decisions = await this.prisma.decision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const reputations = await this.prisma.agentReputation.findMany({
      where: { organizationId: orgId },
      orderBy: { overallReputation: 'desc' },
    });

    const now = new Date().toISOString().split('T')[0];
    const totalDecisions = decisions.length;
    const verifiedCount = decisions.filter((d) => d.outcomeVerified).length;
    const correctCount = decisions.filter((d) => d.outcomeCorrect).length;
    const avgConfidence = totalDecisions > 0
      ? decisions.reduce((sum, d) => sum + Number(d.confidence), 0) / totalDecisions
      : 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Decision Audit Report — ${orgName}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; line-height: 1.5; font-size: 11px; }
  h1 { font-size: 22px; color: #0a0a0f; border-bottom: 2px solid #06b6d4; padding-bottom: 8px; }
  h2 { font-size: 16px; color: #1e293b; margin-top: 24px; }
  .meta { color: #64748b; font-size: 10px; margin-bottom: 16px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .summary-card .value { font-size: 24px; font-weight: 700; color: #06b6d4; }
  .summary-card .label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10px; }
  th { background: #f1f5f9; text-align: left; padding: 8px 6px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
  td { padding: 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:nth-child(even) { background: #f8fafc; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-red { background: #fecaca; color: #991b1b; }
  .badge-gray { background: #f1f5f9; color: #64748b; }
  .truncate { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 9px; text-align: center; }
</style>
</head>
<body>
<h1>Decision Audit Report</h1>
<div class="meta">${orgName} &bull; Generated ${now} &bull; ${totalDecisions} decisions</div>

<div class="summary-grid">
  <div class="summary-card"><div class="value">${totalDecisions}</div><div class="label">Total Decisions</div></div>
  <div class="summary-card"><div class="value">${verifiedCount}</div><div class="label">Verified</div></div>
  <div class="summary-card"><div class="value">${correctCount}</div><div class="label">Correct</div></div>
  <div class="summary-card"><div class="value">${(avgConfidence * 100).toFixed(1)}%</div><div class="label">Avg Confidence</div></div>
</div>

<h2>Decision Log</h2>
<table>
<thead>
  <tr><th>#</th><th>Agent</th><th>Input</th><th>Confidence</th><th>Memories</th><th>Verified</th><th>Correct</th><th>Date</th></tr>
</thead>
<tbody>
${decisions.map((d, i) => `  <tr>
    <td>${i + 1}</td>
    <td>${d.agentId || '—'}</td>
    <td class="truncate">${(d.inputQuery || '').replace(/\u003c/g, '&lt;').substring(0, 80)}</td>
    <td>${(Number(d.confidence) * 100).toFixed(0)}%</td>
    <td>${(d.retrievedMemoryIds || []).length}</td>
    <td>${d.outcomeVerified ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-gray">No</span>'}</td>
    <td>${d.outcomeCorrect === true ? '<span class="badge badge-green">Yes</span>' : d.outcomeCorrect === false ? '<span class="badge badge-red">No</span>' : '<span class="badge badge-gray">—</span>'}</td>
    <td>${d.createdAt.toISOString().split('T')[0]}</td>
  </tr>`).join('\n')}
</tbody>
</table>

${reputations.length > 0 ? `
<h2>Agent Reputation Summary</h2>
<table>
<thead>
  <tr><th>Agent</th><th>Department</th><th>Overall</th><th>Write Quality</th><th>Decision Acc.</th><th>Collaboration</th><th>Expertise</th></tr>
</thead>
<tbody>
${reputations.map((r) => `  <tr>
    <td>${r.agentId}</td>
    <td>${r.departmentId || 'org-wide'}</td>
    <td><strong>${Number(r.overallReputation).toFixed(0)}</strong></td>
    <td>${Number(r.writeQuality).toFixed(0)}</td>
    <td>${Number(r.decisionAccuracy).toFixed(0)}</td>
    <td>${Number(r.collaborationScore).toFixed(0)}</td>
    <td>${Number(r.domainExpertise).toFixed(0)}</td>
  </tr>`).join('\n')}
</tbody>
</table>` : ''}

<div class="footer">
  Awareness Network &mdash; AI Organization Governance Infrastructure &mdash; Confidential
</div>
</body>
</html>`;
  }
}

export function createReportExporter(prisma: PrismaClient) {
  return new ReportExporter(prisma);
}
