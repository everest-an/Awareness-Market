import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Awareness Network',
  description: 'AI Capability Trading Marketplace - Developer Documentation',
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'API Reference', link: '/api/overview' },
      { text: 'Examples', link: '/examples/python' },
      { text: 'Marketplace', link: 'https://your-domain.manus.space' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Authentication', link: '/guide/authentication' },
            { text: 'Concepts', link: '/guide/concepts' }
          ]
        },
        {
          text: 'Integration',
          items: [
            { text: 'AI Agent Integration', link: '/guide/ai-agent-integration' },
            { text: 'MCP Protocol', link: '/guide/mcp-protocol' },
            { text: 'LatentMAS', link: '/guide/latentmas' },
            { text: 'Memory Sync', link: '/guide/memory-sync' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/overview' },
            { text: 'Authentication', link: '/api/authentication' },
            { text: 'Vectors', link: '/api/vectors' },
            { text: 'Transactions', link: '/api/transactions' },
            { text: 'Recommendations', link: '/api/recommendations' },
            { text: 'Trials', link: '/api/trials' },
            { text: 'MCP Endpoints', link: '/api/mcp' },
            { text: 'LatentMAS', link: '/api/latentmas' }
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Code Examples',
          items: [
            { text: 'Python', link: '/examples/python' },
            { text: 'JavaScript/Node.js', link: '/examples/javascript' },
            { text: 'cURL', link: '/examples/curl' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/everest-an/Awareness-Network' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Awareness Network'
    },
    search: {
      provider: 'local'
    }
  }
})
