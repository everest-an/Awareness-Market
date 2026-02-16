import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // 简单的markdown解析（可以后续升级为react-markdown）
  const parseMarkdown = (md: string) => {
    return md
      // H1
      .replace(/^# (.*$)/gim, '<h1 class="text-4xl font-bold mt-8 mb-4">$1</h1>')
      // H2
      .replace(/^## (.*$)/gim, '<h2 class="text-3xl font-semibold mt-6 mb-3">$1</h2>')
      // H3
      .replace(/^### (.*$)/gim, '<h3 class="text-2xl font-semibold mt-4 mb-2">$1</h3>')
      // H4
      .replace(/^#### (.*$)/gim, '<h4 class="text-xl font-semibold mt-3 mb-2">$1</h4>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold">$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
      // Inline code
      .replace(/`([^`]+)`/gim, '<code class="bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/gim, '<pre class="bg-gray-900 dark:bg-black rounded-lg p-4 overflow-x-auto my-4"><code>$2</code></pre>')
      // Lists
      .replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
      // Paragraphs
      .replace(/\n\n/gim, '</p><p class="my-4">')
      // Blockquotes
      .replace(/^&gt; (.*$)/gim, '<blockquote class="border-l-4 border-blue-500 pl-4 italic my-4">$1</blockquote>')
      .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-blue-500 pl-4 italic my-4">$1</blockquote>');
  };

  return (
    <div
      className="prose prose-slate max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: `<p class="my-4">${parseMarkdown(content)}</p>` }}
    />
  );
};
