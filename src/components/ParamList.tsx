import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

// Request/response parameters.
// Wide area (desktop): a compact 3-column table — Parameter (name + type + location), Required, Description.
// Narrow area (phone): one card per parameter. The choice follows the real width of the block, not the screen.
export type ParamItem = { name: string; type?: string; in?: string; required: boolean; description?: string };

type Labels = { required: string; optional: string; name?: string; requiredHeader?: string; description?: string };

const TABLE_MIN_WIDTH = 400;

/** Allows line breaks only after "." and "]" so names like Services[].Products[].LineNo never break letter by letter. */
const breakableName = (name: string) =>
  name.replace(/([.\]])/g, '$1\u0000').split('\u0000').filter(Boolean).map((part, index) => (
    <React.Fragment key={index}>
      {index > 0 && <wbr />}
      <span className="whitespace-nowrap">{part}</span>
    </React.Fragment>
  ));

const Badges: React.FC<{ item: ParamItem }> = ({ item }) => (
  <>
    {item.type && <span className="bg-paynet-gray-100 text-paynet-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">{item.type}</span>}
    {item.in && (
      <span
        className={`px-1.5 py-0.5 text-xs rounded ${
          item.in === 'path' ? 'bg-purple-100 text-purple-800' : item.in === 'query' ? 'bg-blue-100 text-blue-800' : 'bg-paynet-light text-paynet-dark'
        }`}
      >
        {item.in}
      </span>
    )}
  </>
);

const ParamList: React.FC<{ items: ParamItem[]; labels: Labels }> = ({ items, labels }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [wide, setWide] = React.useState(true);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWide(element.clientWidth >= TABLE_MIN_WIDTH);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-param-list className="w-full">
      {wide ? (
        <div className="rounded-lg border border-paynet-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-paynet-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{labels.name || 'Parameter'}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary whitespace-nowrap">
                  {labels.requiredHeader || labels.required}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">{labels.description || 'Description'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paynet-gray-200">
              {items.map((item, index) => (
                <tr key={`${item.name}-${index}`} className="align-top hover:bg-paynet-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <code className="block font-mono text-sm font-semibold text-paynet-gray-900">{breakableName(item.name)}</code>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badges item={item} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {item.required ? (
                      <span className="inline-flex items-center gap-1 text-paynet-error font-medium">
                        <AlertCircle className="w-4 h-4" />
                        {labels.required}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-paynet-success">
                        <CheckCircle className="w-4 h-4" />
                        {labels.optional}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-paynet-gray-600 break-words">{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="divide-y divide-paynet-gray-200 border-y border-paynet-gray-200">
          {items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <code className="font-mono text-sm font-semibold text-paynet-gray-900">{breakableName(item.name)}</code>
                <Badges item={item} />
                <span className={`text-xs font-medium ${item.required ? 'text-paynet-error' : 'text-paynet-gray-500'}`}>
                  {item.required ? labels.required : labels.optional}
                </span>
              </div>
              {item.description && <p className="mt-1 text-sm text-paynet-gray-600 break-words">{item.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParamList;
