import React from 'react';
import { Download, Puzzle } from 'lucide-react';

type PluginItem = {
  name: string;
  logoUrl: string;
  downloadUrl: string;
};

const plugins: PluginItem[] = [
  {
    name: 'Shopify',
    logoUrl: '/logos/shopify.png',
    downloadUrl: 'https://developer.cybersource.com/technology-partners/Shopify_Managed.html',
  },
  {
    name: 'WordPress',
    logoUrl: '/logos/wordpress.png',
    downloadUrl: 'https://info.paynet.md/plugin/cms-wordpress.zip',
  },
  {
    name: 'OpenCart',
    logoUrl: '/logos/opencart.png',
    downloadUrl: 'https://info.paynet.md/plugin/cms-opencart.zip',
  },
  {
    name: 'CS-Cart',
    logoUrl: '/logos/cscart.png',
    downloadUrl: 'https://info.paynet.md/plugin/cms-cscart.zip',
  },
  {
    name: 'PrestaShop',
    logoUrl: '/logos/prestashop.png',
    downloadUrl: 'https://info.paynet.md/plugin/cms-prestashop.zip',
  },
  {
    name: 'Magento',
    logoUrl: '/logos/magento.png',
    downloadUrl: 'https://info.paynet.md/plugin/cms-magento.zip',
  },
];

export const PluginsOverview: React.FC = () => {
  return (
    <div className="w-full max-w-none">
      <div className="mb-4 sm:mb-8">
        <div className="flex items-center gap-3 mb-2 sm:mb-3">
          <Puzzle className="w-6 sm:w-8 h-6 sm:h-8 text-paynet-primary" />
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Plugins</h1>
        </div>
        <p className="text-sm sm:text-base text-paynet-gray-700">
          Download ready-to-use ecommerce plugins for supported platforms.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {plugins.map((plugin) => (
          <div
            key={plugin.name}
            className="bg-white border border-paynet-gray-200 rounded-lg shadow-paynet-lg p-5 flex flex-col items-center text-center"
          >
            <div className="h-24 sm:h-28 w-full mb-4 flex items-center justify-center">
              <img
                src={plugin.logoUrl}
                alt={plugin.name}
                className="max-h-full max-w-[85%] object-contain"
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            </div>

            <div className="text-base sm:text-lg font-semibold text-paynet-gray-900 mb-3">{plugin.name}</div>

            <a
              href={plugin.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-paynet-primary text-white text-sm font-medium hover:bg-paynet-secondary transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};
