import React from 'react';

// Parameter list (name, type, location, required, description) — readable on phones and wide screens.
export type ParamItem = { name: string; type?: string; in?: string; required: boolean; description?: string };
const ParamList: React.FC<{ items: ParamItem[]; labels: { required: string; optional: string } }> = ({ items, labels }) => (
  <div data-param-list className="divide-y divide-paynet-gray-200 border-y border-paynet-gray-200">
    {items.map((item, index) => (
      <div key={`${item.name}-${index}`} className="py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <code className="font-mono text-sm font-semibold text-paynet-gray-900 break-all">{item.name}</code>
          {item.type && <span className="bg-paynet-gray-100 text-paynet-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">{item.type}</span>}
          {item.in && (
            <span className={`px-1.5 py-0.5 text-xs rounded ${
              item.in === 'path' ? 'bg-purple-100 text-purple-800' : item.in === 'query' ? 'bg-blue-100 text-blue-800' : 'bg-paynet-light text-paynet-dark'
            }`}>{item.in}</span>
          )}
          <span className={`text-xs font-medium ${item.required ? 'text-paynet-error' : 'text-paynet-gray-500'}`}>
            {item.required ? labels.required : labels.optional}
          </span>
        </div>
        {item.description && <p className="mt-1 text-sm text-paynet-gray-600 break-words">{item.description}</p>}
      </div>
    ))}
  </div>
);

export default ParamList;
