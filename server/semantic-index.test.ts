import { describe, it, expect, beforeEach } from "vitest";
import * as semanticIndex from "./semantic-index";

describe("Semantic Index Service", () => {
  describe("findMemoryByTopic", () => {
    it("should find memories matching topic keywords", () => {
      const results = semanticIndex.findMemoryByTopic("python", 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].memory.semantic_context.keywords.some(k => 
        k.toLowerCase().includes("python")
      )).toBe(true);
    });

    it("should return empty array for non-matching topics", () => {
      const results = semanticIndex.findMemoryByTopic("xyznonexistent123", 5);
      expect(results.length).toBe(0);
    });

    it("should respect limit parameter", () => {
      const results = semanticIndex.findMemoryByTopic("code", 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("should sort results by relevance score", () => {
      const results = semanticIndex.findMemoryByTopic("security", 10);
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].relevance_score).toBeGreaterThanOrEqual(results[i].relevance_score);
        }
      }
    });
  });

  describe("findMemoryByDomain", () => {
    it("should find memories by domain category", () => {
      const results = semanticIndex.findMemoryByDomain("blockchain_security", 10);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.memory.semantic_context.domain).toBe("blockchain_security");
      });
    });

    it("should have match_type of domain", () => {
      const results = semanticIndex.findMemoryByDomain("code_generation", 5);
      results.forEach(r => {
        expect(r.match_type).toBe("domain");
      });
    });
  });

  describe("findMemoryByTask", () => {
    it("should find memories by task type", () => {
      const results = semanticIndex.findMemoryByTask("reasoning_and_analysis", 10);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.memory.semantic_context.task_type).toBe("reasoning_and_analysis");
      });
    });
  });

  describe("semanticSearch", () => {
    it("should combine query and domain filters", () => {
      const results = semanticIndex.semanticSearch({
        query: "security",
        domain: "blockchain_security",
        limit: 10
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.memory.semantic_context.domain).toBe("blockchain_security");
      });
    });

    it("should filter by public access", () => {
      const results = semanticIndex.semanticSearch({
        is_public: true,
        limit: 50
      });
      results.forEach(r => {
        expect(r.memory.access_control.is_public).toBe(true);
      });
    });
  });

  describe("getNetworkStats", () => {
    it("should return valid statistics", () => {
      const stats = semanticIndex.getNetworkStats();
      expect(stats.total_memories).toBeGreaterThan(0);
      expect(stats.public_memories).toBeGreaterThanOrEqual(0);
      expect(stats.total_agents).toBeGreaterThanOrEqual(0);
      expect(stats.active_agents_24h).toBeGreaterThanOrEqual(0);
      expect(stats.new_agents_7d).toBeGreaterThanOrEqual(0);
      expect(stats.total_domains).toBeGreaterThan(0);
      expect(stats.total_task_types).toBeGreaterThan(0);
      expect(stats.supported_models).toBeGreaterThan(0);
    });
  });

  describe("getMemoryLeaderboard", () => {
    it("should return memories sorted by usage count", () => {
      const leaderboard = semanticIndex.getMemoryLeaderboard(10);
      expect(leaderboard.length).toBeLessThanOrEqual(10);
      if (leaderboard.length > 1) {
        for (let i = 1; i < leaderboard.length; i++) {
          expect(leaderboard[i - 1].provenance.usage_count)
            .toBeGreaterThanOrEqual(leaderboard[i].provenance.usage_count);
        }
      }
    });
  });

  describe("getAvailableDomains", () => {
    it("should return list of domain categories", () => {
      const domains = semanticIndex.getAvailableDomains();
      expect(domains.length).toBeGreaterThan(0);
      expect(domains).toContain("blockchain_security");
      expect(domains).toContain("code_generation");
    });
  });

  describe("getAvailableTaskTypes", () => {
    it("should return list of task types", () => {
      const taskTypes = semanticIndex.getAvailableTaskTypes();
      expect(taskTypes.length).toBeGreaterThan(0);
      expect(taskTypes).toContain("reasoning_and_analysis");
      expect(taskTypes).toContain("code_generation");
    });
  });
});

describe("Agent Registry", () => {
  describe("registerAgent", () => {
    it("should register a new agent and return it", () => {
      const agent = semanticIndex.registerAgent({
        name: "TestAgent",
        description: "A test agent for unit testing",
        model_type: "llama-3-70b",
        capabilities: ["testing", "validation"],
        tba_address: "0x1234567890abcdef"
      });

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe("TestAgent");
      expect(agent.model_type).toBe("llama-3-70b");
      expect(agent.capabilities).toContain("testing");
      expect(agent.reputation_score).toBe(0);
      expect(agent.memories_published).toBe(0);
      expect(agent.memories_consumed).toBe(0);
    });
  });

  describe("getAgent", () => {
    it("should retrieve registered agent by ID", () => {
      const registered = semanticIndex.registerAgent({
        name: "RetrieveTestAgent",
        description: "Agent for retrieval test",
        model_type: "gpt-4",
        capabilities: ["retrieval"],
        tba_address: "0xabcdef1234567890"
      });

      const retrieved = semanticIndex.getAgent(registered.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe("RetrieveTestAgent");
    });

    it("should return null for non-existent agent", () => {
      const result = semanticIndex.getAgent("non-existent-id");
      expect(result).toBeNull();
    });
  });

  describe("listAgents", () => {
    it("should list all registered agents", () => {
      semanticIndex.registerAgent({
        name: "ListTestAgent",
        description: "Agent for list test",
        model_type: "claude-3-opus",
        capabilities: ["listing"],
        tba_address: "0x111222333444"
      });

      const agents = semanticIndex.listAgents({ limit: 100 });
      expect(agents.length).toBeGreaterThan(0);
    });

    it("should filter by model type", () => {
      semanticIndex.registerAgent({
        name: "FilterTestAgent",
        description: "Agent for filter test",
        model_type: "mistral-7b",
        capabilities: ["filtering"],
        tba_address: "0x555666777888"
      });

      const agents = semanticIndex.listAgents({ model_type: "mistral-7b", limit: 50 });
      agents.forEach(a => {
        expect(a.model_type).toBe("mistral-7b");
      });
    });

    it("should filter by capability", () => {
      semanticIndex.registerAgent({
        name: "CapabilityTestAgent",
        description: "Agent for capability test",
        model_type: "llama-3-8b",
        capabilities: ["unique-capability-xyz"],
        tba_address: "0x999aaa"
      });

      const agents = semanticIndex.listAgents({ capability: "unique-capability-xyz", limit: 50 });
      agents.forEach(a => {
        expect(a.capabilities).toContain("unique-capability-xyz");
      });
    });
  });

  describe("updateAgentActivity", () => {
    it("should update agent stats on publish", () => {
      const agent = semanticIndex.registerAgent({
        name: "ActivityTestAgent",
        description: "Agent for activity test",
        model_type: "gpt-4-turbo",
        capabilities: ["activity"],
        tba_address: "0xbbbccc"
      });

      const initialRep = agent.reputation_score;
      const initialPublished = agent.memories_published;

      semanticIndex.updateAgentActivity(agent.id, "publish");

      const updated = semanticIndex.getAgent(agent.id);
      expect(updated?.memories_published).toBe(initialPublished + 1);
      expect(updated?.reputation_score).toBe(initialRep + 10);
    });

    it("should update agent stats on consume", () => {
      const agent = semanticIndex.registerAgent({
        name: "ConsumeTestAgent",
        description: "Agent for consume test",
        model_type: "claude-3-sonnet",
        capabilities: ["consuming"],
        tba_address: "0xdddeee"
      });

      const initialRep = agent.reputation_score;
      const initialConsumed = agent.memories_consumed;

      semanticIndex.updateAgentActivity(agent.id, "consume");

      const updated = semanticIndex.getAgent(agent.id);
      expect(updated?.memories_consumed).toBe(initialConsumed + 1);
      expect(updated?.reputation_score).toBe(initialRep + 1);
    });
  });

  describe("getRecentAgents", () => {
    it("should return recently registered agents", () => {
      semanticIndex.registerAgent({
        name: "RecentAgent1",
        description: "Recent agent 1",
        model_type: "llama-3-70b",
        capabilities: ["recent"],
        tba_address: "0xfff111"
      });

      const recent = semanticIndex.getRecentAgents(5);
      expect(recent.length).toBeGreaterThan(0);
      expect(recent.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getTopAgents", () => {
    it("should return agents sorted by reputation", () => {
      const agent = semanticIndex.registerAgent({
        name: "TopAgent",
        description: "Top agent",
        model_type: "gpt-4o",
        capabilities: ["top"],
        tba_address: "0xfff222"
      });
      
      for (let i = 0; i < 5; i++) {
        semanticIndex.updateAgentActivity(agent.id, "publish");
      }

      const top = semanticIndex.getTopAgents(10);
      expect(top.length).toBeGreaterThan(0);
      
      if (top.length > 1) {
        for (let i = 1; i < top.length; i++) {
          expect(top[i - 1].reputation_score).toBeGreaterThanOrEqual(top[i].reputation_score);
        }
      }
    });
  });

  describe("searchAgentsByCapability", () => {
    it("should find agents by capability keyword", () => {
      semanticIndex.registerAgent({
        name: "SecurityBot",
        description: "Specialized in security auditing",
        model_type: "llama-3-70b",
        capabilities: ["solidity-audit", "security-review"],
        tba_address: "0xfff333"
      });

      const results = semanticIndex.searchAgentsByCapability("security", 10);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("getAgentActivityTimeline", () => {
    it("should return 7-day activity timeline", () => {
      const timeline = semanticIndex.getAgentActivityTimeline();
      expect(timeline.length).toBe(7);
      timeline.forEach(day => {
        expect(day.date).toBeDefined();
        expect(typeof day.registrations).toBe("number");
        expect(typeof day.active).toBe("number");
      });
    });
  });

  describe("getMemoryUsageByDomain", () => {
    it("should return domain usage statistics", () => {
      const usage = semanticIndex.getMemoryUsageByDomain();
      expect(usage.length).toBeGreaterThan(0);
      usage.forEach(d => {
        expect(d.domain).toBeDefined();
        expect(typeof d.count).toBe("number");
        expect(typeof d.totalCalls).toBe("number");
      });
    });
  });
});
