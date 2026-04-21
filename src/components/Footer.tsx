import React from 'react';

interface FooterProps {
  author: string;
  version: string;
}

export const Footer: React.FC<FooterProps> = ({ author, version }) => {
  return (
    <footer className="bg-white border-t border-paynet-gray-200 py-4 px-6 flex-shrink-0">
      <div className="text-center">
        <p className="text-sm text-paynet-gray-600">
          <span className="font-medium text-paynet-primary">{author}</span>
          {' • '}
          <span className="text-paynet-gray-500">Version {version}</span>
        </p>
      </div>
    </footer>
  );
};