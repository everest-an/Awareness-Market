import React from 'react';
import { DocsSidebar } from './DocsSidebar';
import { DocsContent } from './DocsContent';

export const DocsLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-900">
      <DocsSidebar />
      <DocsContent />
    </div>
  );
};
