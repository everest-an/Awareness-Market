import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { docsStructure, DocItem } from './docs-config';

interface SidebarItemProps {
  item: DocItem;
  level?: number;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ item, level = 0 }) => {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const isActive = location === item.path;
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className={`${level > 0 ? 'ml-4' : ''}`}>
      <div className="flex items-center group">
        {hasChildren && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded mr-1"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-4 h-4 text-gray-500 transform transition-transform ${
                isOpen ? 'rotate-90' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
        <Link
          href={item.path}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {item.title}
        </Link>
      </div>
      {hasChildren && isOpen && (
        <div className="mt-1 space-y-1">
          {item.children!.map((child, idx) => (
            <SidebarItem key={idx} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const DocsSidebar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {mobileOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`
          w-64 h-screen sticky top-0 overflow-y-auto
          border-r border-gray-200 dark:border-gray-800
          bg-white dark:bg-gray-900
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          fixed lg:static z-40
        `}
      >
        <div className="p-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center space-x-2 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800"
          >
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              Awareness Market
            </span>
          </Link>

          {/* Search bar placeholder */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search docs..."
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {docsStructure.map((item, idx) => (
              <SidebarItem key={idx} item={item} />
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          aria-hidden="true"
        />
      )}
    </>
  );
};
