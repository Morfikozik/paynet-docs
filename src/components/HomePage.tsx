import React from 'react';
import { ArrowRight, Bot, Rocket, ShoppingCart, BookOpen } from 'lucide-react';
import { Language } from '../types/language';
import { getSectionGuides, guideUiText } from '../content/guides';

interface HomePageProps {
  language: Language;
  onNavigate: (hash: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ language, onNavigate }) => {
  const ui = guideUiText[language];
  const commonGuides = getSectionGuides(language, 'common');

  const linkButton = (label: string, hash: string) => (
    <button
      key={hash}
      type="button"
      onClick={() => onNavigate(hash)}
      className="inline-flex items-center gap-1 text-sm font-medium text-paynet-primary hover:text-paynet-secondary"
    >
      {label}
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div className="max-w-5xl">
      <section className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-paynet-primary mb-3">{ui.homeTitle}</h1>
        <p className="text-base sm:text-lg text-paynet-gray-600 max-w-3xl mb-6">{ui.homeSubtitle}</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate('#/guides/getting-started')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-paynet bg-paynet-primary text-white font-medium hover:bg-paynet-secondary transition-colors"
          >
            <Rocket className="w-4 h-4" />
            {ui.quickStart}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('#/guides/server-to-server')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-paynet border border-paynet-primary text-paynet-primary bg-white font-medium hover:bg-paynet-light transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            {ui.apiReference}
          </button>
          <a
            href="llms-full.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-paynet border border-paynet-gray-300 text-paynet-gray-700 bg-white font-medium hover:bg-paynet-gray-50 transition-colors"
            title={ui.forAiHint}
          >
            <Bot className="w-4 h-4" />
            {ui.forAi}
          </a>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-paynet-gray-900 mb-4">{ui.homeProducts}</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white rounded-paynet border border-paynet-gray-200 shadow-paynet p-6 flex flex-col border-b-4 border-b-paynet-primary">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-5 h-5 text-paynet-primary" />
              <h3 className="text-lg font-semibold text-paynet-gray-900">E-commerce</h3>
            </div>
            <p className="text-sm text-paynet-gray-600 mb-4 flex-1">{ui.ecomCardText}</p>
            <div className="flex flex-col items-start gap-1.5">
              {ui.ecomLinks.map((link) => linkButton(link.label, link.hash))}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-paynet-gray-900 mb-4">{ui.homeGeneral}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {commonGuides.map((guide) => (
            <button
              key={guide.slug}
              type="button"
              onClick={() => onNavigate(`#/guides/${guide.slug}`)}
              className="text-left bg-white rounded-paynet border border-paynet-gray-200 p-4 hover:border-paynet-primary hover:shadow-paynet transition-all"
            >
              <div className="font-medium text-paynet-gray-900 mb-1">{guide.title}</div>
              <div className="text-xs text-paynet-primary inline-flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold text-paynet-gray-900 mb-4">{ui.homeEnvironments}</h2>
        <div className="overflow-x-auto border border-paynet-gray-200 rounded-paynet">
          <table className="min-w-full text-sm">
            <thead className="bg-paynet-light">
              <tr>
                <th className="text-left font-semibold text-paynet-gray-800 px-3 py-2"></th>
                <th className="text-left font-semibold text-paynet-gray-800 px-3 py-2">{ui.testEnv}</th>
                <th className="text-left font-semibold text-paynet-gray-800 px-3 py-2">{ui.prodEnv}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="px-3 py-2 font-medium text-paynet-gray-800">{ui.envApi}</td>
                <td className="px-3 py-2 font-mono text-xs">https://ecom-api-test.paynet.md</td>
                <td className="px-3 py-2 font-mono text-xs">https://ecom-api.paynet.md</td>
              </tr>
              <tr className="bg-paynet-gray-50">
                <td className="px-3 py-2 font-medium text-paynet-gray-800">{ui.envCheckout}</td>
                <td className="px-3 py-2 font-mono text-xs">https://test.paynet.md/ecom/checkout</td>
                <td className="px-3 py-2 font-mono text-xs">https://paynet.md/ecom/checkout</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
