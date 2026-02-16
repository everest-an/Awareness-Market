// 文档结构配置
export interface DocItem {
  title: string;
  path: string;
  file: string;
  children?: DocItem[];
}

export const docsStructure: DocItem[] = [
  {
    title: "Overview",
    path: "/documentation",
    file: "README.md",
    children: [
      {
        title: "What is Awareness Market",
        path: "/documentation/introduction",
        file: "README.md"
      },
      {
        title: "Architecture",
        path: "/documentation/architecture",
        file: "overview/architecture.md"
      },
      {
        title: "Quick Start",
        path: "/documentation/quick-start",
        file: "overview/quick-start.md"
      }
    ]
  },
  {
    title: "Products",
    path: "/documentation/products",
    file: "products/vector-packages/README.md",
    children: [
      {
        title: "Vector Packages",
        path: "/documentation/products/vector-packages",
        file: "products/vector-packages/README.md",
        children: [
          {
            title: "How Vectors Work",
            path: "/documentation/products/vector-packages/how-vectors-work",
            file: "products/vector-packages/how-vectors-work.md"
          },
          {
            title: "Buying & Selling",
            path: "/documentation/products/vector-packages/buying-selling",
            file: "products/vector-packages/buying-and-selling.md"
          },
          {
            title: "W-Matrix Alignment",
            path: "/documentation/products/vector-packages/w-matrix",
            file: "products/vector-packages/w-matrix-alignment.md"
          }
        ]
      },
      {
        title: "Memory Packages",
        path: "/documentation/products/memory-packages",
        file: "products/memory-packages/README.md",
        children: [
          {
            title: "KV-Cache Transfer",
            path: "/documentation/products/memory-packages/kv-cache",
            file: "products/memory-packages/kv-cache-transfer.md"
          },
          {
            title: "Cross-Model Compatibility",
            path: "/documentation/products/memory-packages/cross-model",
            file: "products/memory-packages/cross-model-compatibility.md"
          },
          {
            title: "Quality & Retention",
            path: "/documentation/products/memory-packages/quality",
            file: "products/memory-packages/quality-and-retention.md"
          }
        ]
      },
      {
        title: "Reasoning Chains",
        path: "/documentation/products/reasoning-chains",
        file: "products/reasoning-chains/README.md",
        children: [
          {
            title: "Chain Structure",
            path: "/documentation/products/reasoning-chains/structure",
            file: "products/reasoning-chains/chain-structure.md"
          },
          {
            title: "Publishing Chains",
            path: "/documentation/products/reasoning-chains/publishing",
            file: "products/reasoning-chains/publishing-chains.md"
          },
          {
            title: "Evaluation Metrics",
            path: "/documentation/products/reasoning-chains/evaluation",
            file: "products/reasoning-chains/evaluation-metrics.md"
          }
        ]
      },
      {
        title: "Robotics (RMC)",
        path: "/documentation/products/robotics",
        file: "products/robotics/README.md",
        children: [
          {
            title: "Architecture",
            path: "/documentation/products/robotics/architecture",
            file: "products/robotics/architecture.md"
          },
          {
            title: "Multi-Robot Coordination",
            path: "/documentation/products/robotics/coordination",
            file: "products/robotics/multi-robot-coordination.md"
          },
          {
            title: "VR Control (WebXR)",
            path: "/documentation/products/robotics/vr-control",
            file: "products/robotics/vr-control.md"
          },
          {
            title: "ROS2 Bridge",
            path: "/documentation/products/robotics/ros2",
            file: "products/robotics/ros2-bridge.md"
          }
        ]
      }
    ]
  },
  {
    title: "AI Collaboration",
    path: "/documentation/ai-collaboration",
    file: "ai-collaboration/README.md",
    children: [
      {
        title: "Real-time Sessions",
        path: "/documentation/ai-collaboration/sessions",
        file: "ai-collaboration/real-time-sessions.md"
      },
      {
        title: "MCP Integration",
        path: "/documentation/ai-collaboration/mcp",
        file: "ai-collaboration/mcp-integration.md"
      },
      {
        title: "Session Management",
        path: "/documentation/ai-collaboration/management",
        file: "ai-collaboration/session-management.md"
      }
    ]
  },
  {
    title: "Developer Guide",
    path: "/documentation/developer-guide",
    file: "developer-guide/python-sdk/README.md",
    children: [
      {
        title: "Python SDK",
        path: "/documentation/developer-guide/python-sdk",
        file: "developer-guide/python-sdk/README.md",
        children: [
          {
            title: "Installation",
            path: "/documentation/developer-guide/python-sdk/installation",
            file: "developer-guide/python-sdk/installation.md"
          },
          {
            title: "Quick Start",
            path: "/documentation/developer-guide/python-sdk/quick-start",
            file: "developer-guide/python-sdk/quick-start.md"
          },
          {
            title: "Async & Streaming",
            path: "/documentation/developer-guide/python-sdk/async",
            file: "developer-guide/python-sdk/async-and-streaming.md"
          },
          {
            title: "API Reference",
            path: "/documentation/developer-guide/python-sdk/api",
            file: "developer-guide/python-sdk/api-reference.md"
          }
        ]
      },
      {
        title: "JavaScript SDK",
        path: "/documentation/developer-guide/javascript-sdk",
        file: "developer-guide/javascript-sdk/README.md",
        children: [
          {
            title: "Installation",
            path: "/documentation/developer-guide/javascript-sdk/installation",
            file: "developer-guide/javascript-sdk/installation.md"
          },
          {
            title: "Quick Start",
            path: "/documentation/developer-guide/javascript-sdk/quick-start",
            file: "developer-guide/javascript-sdk/quick-start.md"
          },
          {
            title: "API Reference",
            path: "/documentation/developer-guide/javascript-sdk/api",
            file: "developer-guide/javascript-sdk/api-reference.md"
          }
        ]
      },
      {
        title: "MCP Server",
        path: "/documentation/developer-guide/mcp-server",
        file: "developer-guide/mcp-server/README.md",
        children: [
          {
            title: "Setup & Configuration",
            path: "/documentation/developer-guide/mcp-server/setup",
            file: "developer-guide/mcp-server/setup.md"
          },
          {
            title: "Available Tools",
            path: "/documentation/developer-guide/mcp-server/tools",
            file: "developer-guide/mcp-server/available-tools.md"
          },
          {
            title: "Claude Desktop Integration",
            path: "/documentation/developer-guide/mcp-server/claude",
            file: "developer-guide/mcp-server/claude-desktop.md"
          }
        ]
      },
      {
        title: "REST API",
        path: "/documentation/developer-guide/rest-api",
        file: "developer-guide/rest-api/README.md",
        children: [
          {
            title: "Authentication",
            path: "/documentation/developer-guide/rest-api/auth",
            file: "developer-guide/rest-api/authentication.md"
          },
          {
            title: "Endpoints Reference",
            path: "/documentation/developer-guide/rest-api/endpoints",
            file: "developer-guide/rest-api/endpoints.md"
          },
          {
            title: "Rate Limits & Errors",
            path: "/documentation/developer-guide/rest-api/limits",
            file: "developer-guide/rest-api/rate-limits.md"
          }
        ]
      }
    ]
  },
  {
    title: "Technical Deep Dives",
    path: "/documentation/technical",
    file: "technical/latentmas-protocol.md",
    children: [
      {
        title: "LatentMAS Protocol",
        path: "/documentation/technical/latentmas",
        file: "technical/latentmas-protocol.md"
      },
      {
        title: "W-Matrix Theory",
        path: "/documentation/technical/w-matrix",
        file: "technical/w-matrix-theory.md"
      },
      {
        title: "KV-Cache Architecture",
        path: "/documentation/technical/kv-cache",
        file: "technical/kv-cache-architecture.md"
      },
      {
        title: "Neural Cortex Visualizer",
        path: "/documentation/technical/neural-cortex",
        file: "technical/neural-cortex.md"
      },
      {
        title: "ERC-8004 Agent Standard",
        path: "/documentation/technical/erc-8004",
        file: "technical/erc-8004.md"
      },
      {
        title: "ZKP Privacy System",
        path: "/documentation/technical/zkp-privacy",
        file: "technical/zkp-privacy.md"
      }
    ]
  },
  {
    title: "Deployment",
    path: "/documentation/deployment",
    file: "deployment/self-hosting.md",
    children: [
      {
        title: "Self-Hosting Guide",
        path: "/documentation/deployment/self-hosting",
        file: "deployment/self-hosting.md"
      },
      {
        title: "Environment Variables",
        path: "/documentation/deployment/environment",
        file: "deployment/environment-variables.md"
      },
      {
        title: "Database Setup",
        path: "/documentation/deployment/database",
        file: "deployment/database-setup.md"
      },
      {
        title: "Redis Configuration",
        path: "/documentation/deployment/redis",
        file: "deployment/redis-configuration.md"
      },
      {
        title: "Monitoring (Prometheus)",
        path: "/documentation/deployment/monitoring",
        file: "deployment/monitoring.md"
      }
    ]
  },
  {
    title: "Resources",
    path: "/documentation/resources",
    file: "resources/whitepaper.md",
    children: [
      {
        title: "Whitepaper",
        path: "/documentation/resources/whitepaper",
        file: "resources/whitepaper.md"
      },
      {
        title: "Changelog",
        path: "/documentation/resources/changelog",
        file: "resources/changelog.md"
      },
      {
        title: "Contributing",
        path: "/documentation/resources/contributing",
        file: "resources/contributing.md"
      },
      {
        title: "Security",
        path: "/documentation/resources/security",
        file: "resources/security.md"
      },
      {
        title: "Terms & Privacy",
        path: "/documentation/resources/terms",
        file: "resources/terms-and-privacy.md"
      }
    ]
  }
];

// 扁平化文档结构
export const flattenDocs = (items: DocItem[]): DocItem[] => {
  return items.reduce((acc, item) => {
    acc.push(item);
    if (item.children) {
      acc.push(...flattenDocs(item.children));
    }
    return acc;
  }, [] as DocItem[]);
};

// 获取当前文档
export const getDocByPath = (path: string): DocItem | undefined => {
  const allDocs = flattenDocs(docsStructure);
  return allDocs.find(doc => doc.path === path);
};

// 获取下一个/上一个文档
export const getAdjacentDocs = (currentPath: string) => {
  const allDocs = flattenDocs(docsStructure);
  const currentIndex = allDocs.findIndex(doc => doc.path === currentPath);

  return {
    prev: currentIndex > 0 ? allDocs[currentIndex - 1] : null,
    next: currentIndex < allDocs.length - 1 ? allDocs[currentIndex + 1] : null
  };
};
