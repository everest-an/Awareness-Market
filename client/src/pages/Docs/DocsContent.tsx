import React, { useEffect, useState, useRef } from 'react';
import { useLocation, Link } from 'wouter';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';
import { getDocByPath, getAdjacentDocs } from './docs-config';

export const DocsContent: React.FC = () => {
  const [location, navigate] = useLocation();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevPathRef = useRef<string>('');

  const currentPath = location;
  const currentDoc = getDocByPath(currentPath);
  const { prev, next } = getAdjacentDocs(currentPath);

  useEffect(() => {
    // 路径变化时重置状态
    if (prevPathRef.current !== currentPath) {
      setLoading(true);
      setError(null);
      prevPathRef.current = currentPath;
    }

    const loadMarkdown = async () => {
      if (!currentDoc) {
        console.warn('[Docs] No doc found for path:', currentPath);
        // 如果路径以 /documentation 开头但没有匹配，重定向到文档首页
        if (currentPath.startsWith('/documentation') && currentPath !== '/documentation') {
          console.warn('[Docs] Redirecting to /documentation');
          navigate('/documentation');
          return;
        }
        setError('Documentation not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 从 public/docs-content 目录加载 markdown 文件
        const mdPath = `/docs-content/${currentDoc.file}`;
        const response = await fetch(mdPath);

        if (!response.ok) {
          // 检查返回的是否是 HTML（Vite SPA fallback）
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            throw new Error(`File not found: ${mdPath} (server returned HTML fallback)`);
          }
          throw new Error(`Failed to load: ${mdPath} (${response.status})`);
        }

        const text = await response.text();

        // 验证返回的不是 HTML（Vite catch-all 可能返回 index.html）
        if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
          throw new Error(`Received HTML instead of markdown for: ${mdPath}`);
        }

        setContent(text);
      } catch (err) {
        console.error('[Docs] Error loading markdown:', err);
        setError('Failed to load documentation. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadMarkdown();
    // Scroll to top on route change
    window.scrollTo(0, 0);
  }, [currentPath, currentDoc?.path]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading documentation...</p>
        </div>
      </main>
    );
  }

  if (error || !currentDoc) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-4">
        <div className="text-center max-w-md">
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            {error || 'Documentation page not found'}
          </p>
          <button
            onClick={() => navigate('/documentation')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Back to Documentation
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-8 py-4">
          <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">
              Home
            </Link>
            <span>/</span>
            <Link href="/documentation" className="hover:text-blue-600 dark:hover:text-blue-400">
              Documentation
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {currentDoc.title}
            </span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        <MarkdownRenderer content={content} />

        {/* Page navigation */}
        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prev && (
              <Link
                href={prev.path}
                className="group p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              >
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  ← Previous
                </div>
                <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {prev.title}
                </div>
              </Link>
            )}
            {next && (
              <Link
                href={next.path}
                className="group p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors md:ml-auto text-right"
              >
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Next →
                </div>
                <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {next.title}
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Found an issue with this page?{' '}
            <a
              href="https://github.com/awareness-market/platform/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Report it on GitHub
            </a>
          </p>
        </div>
      </div>
    </main>
  );
};
