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
          <span className="text-paynet-gray-500">API {version}</span>
          {' • '}
          <a href="#/guides/changelog" className="text-paynet-gray-500 hover:text-paynet-primary underline underline-offset-2">
            Documentation v3
          </a>
          {' • '}
          <a href="legacy/" className="text-paynet-gray-500 hover:text-paynet-primary underline underline-offset-2">
            Previous portal version
          </a>
        </p>
      </div>
    </footer>
  );
};