import React from 'react';
import { MonitorSmartphone, Shield, Zap, Globe } from 'lucide-react';
import { TranslationResources } from '../types/language';

interface ClientServerOverviewProps {
  t: TranslationResources;
}

export const ClientServerOverview: React.FC<ClientServerOverviewProps> = ({ t }) => {
  const s = t.clientServer;

  const aspects = [
    { title: s.aspect1Title, description: s.aspect1Desc },
    { title: s.aspect2Title, description: s.aspect2Desc },
    { title: s.aspect3Title, description: s.aspect3Desc },
    { title: s.aspect4Title, description: s.aspect4Desc },
    { title: s.aspect5Title, description: s.aspect5Desc },
  ];

  const benefits = [s.benefit1, s.benefit2, s.benefit3, s.benefit4, s.benefit5];

  return (
    <div className="w-full max-w-none">
      <div className="mb-4 sm:mb-8">
        <div className="flex items-center gap-3 mb-6">
          <MonitorSmartphone className="w-6 sm:w-8 h-6 sm:h-8 text-blue-600" />
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{s.pageTitle}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full hover:shadow-paynet-xl transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-5 sm:w-6 h-5 sm:h-6 text-paynet-success" />
            <h3 className="text-base sm:text-lg font-semibold text-paynet-primary">{t.common.secure}</h3>
          </div>
          <p className="text-paynet-gray-600 text-xs sm:text-sm">{t.common.secureDesc}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full hover:shadow-paynet-xl transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="w-5 sm:w-6 h-5 sm:h-6 text-paynet-orange" />
            <h3 className="text-base sm:text-lg font-semibold text-paynet-primary">{t.common.fast}</h3>
          </div>
          <p className="text-paynet-gray-600 text-xs sm:text-sm">{t.common.fastDesc}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-paynet-lg border border-paynet-gray-200 w-full sm:col-span-2 lg:col-span-1 hover:shadow-paynet-xl transition-all duration-200">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="w-5 sm:w-6 h-5 sm:h-6 text-paynet-primary" />
            <h3 className="text-base sm:text-lg font-semibold text-paynet-primary">{t.common.global}</h3>
          </div>
          <p className="text-paynet-gray-600 text-xs sm:text-sm">{t.common.globalDesc}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-paynet-lg border border-paynet-gray-200 overflow-hidden w-full p-6 lg:p-8">
        <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary mb-4">{s.mainTitle}</h2>
        <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed mb-4">{s.introParagraph1}</p>
        <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed mb-8">{s.introParagraph2}</p>

        <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-3">{s.characteristicsTitle}</h3>
        <p className="text-sm sm:text-base text-paynet-gray-700 mb-6">{s.characteristicsIntro}</p>

        <ul className="space-y-6 mb-10 list-none p-0">
          {aspects.map((item, index) => (
            <li key={index} className="border-b border-paynet-gray-100 last:border-0 pb-6 last:pb-0">
              <div className="text-sm sm:text-base font-semibold text-paynet-gray-900 mb-2">{item.title}</div>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed">{item.description}</p>
            </li>
          ))}
        </ul>

        <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-4">{s.keyBenefitsTitle}</h3>
        <ul className="list-disc pl-5 space-y-3 text-sm sm:text-base text-paynet-gray-700">
          {benefits.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      </div>

    </div>
  );
};
