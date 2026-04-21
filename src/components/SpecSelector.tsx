import React from 'react';
import { FileText, ChevronDown } from 'lucide-react';

interface SpecSelectorProps {
  availableSpecs: string[];
  selectedSpec: string;
  onSpecChange: (spec: string) => void;
  specInfo: {
    title: string;
    version: string;
    description?: string;
  };
}

export const SpecSelector: React.FC<SpecSelectorProps> = ({
  availableSpecs,
  selectedSpec,
  onSpecChange,
  specInfo
}) => {
  if (availableSpecs.length <= 1) {
    return null; // Don't show selector if there's only one spec
  }

  return (
    <div className="mb-4 p-4 bg-paynet-light border border-paynet-gray-200 rounded-paynet">
      <div className="flex items-center gap-3 mb-2">
        <FileText className="w-5 h-5 text-paynet-primary" />
        <h3 className="text-sm font-semibold text-paynet-primary">API Specification</h3>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative">
          <select
            value={selectedSpec}
            onChange={(e) => onSpecChange(e.target.value)}
            className="appearance-none bg-white border border-paynet-gray-300 rounded-paynet px-4 py-2 pr-8 text-sm font-medium text-paynet-gray-700 hover:border-paynet-primary focus:outline-none focus:ring-2 focus:ring-paynet-primary focus:border-transparent"
          >
            {availableSpecs.map((spec) => (
              <option key={spec} value={spec}>
                {spec.charAt(0).toUpperCase() + spec.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-paynet-gray-400 pointer-events-none" />
        </div>
        
        <div className="flex-1">
          <div className="text-sm font-medium text-paynet-gray-900">
            {specInfo.title} <span className="text-paynet-gray-500">v{specInfo.version}</span>
          </div>
          {specInfo.description && (
            <div className="text-xs text-paynet-gray-600 mt-1">
              {specInfo.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};