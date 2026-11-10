/**
 * Sidebar look only: groups, short labels and icons.
 * Page addresses (#/guides/<slug>, #/page/..., #/api/...) and page titles are NOT changed here.
 * A guide that is not listed below still appears in the sidebar (in the last group), so nothing can disappear.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Zap,
  LayoutGrid,
  FlaskConical,
  Server,
  Code,
  Bell,
  KeyRound,
  CreditCard,
  Info,
  ShoppingCart,
  Check,
  Puzzle,
  Bot,
  HelpCircle,
  History,
  FileText,
} from 'lucide-react';
import { Language } from '../types/language';

type Label = Record<Language, string>;

export type NavEntry =
  | { kind: 'home'; icon: LucideIcon; label: Label }
  | { kind: 'guide'; slug: string; icon: LucideIcon; label: Label }
  | { kind: 'page'; page: 'plugins'; icon: LucideIcon; label: Label };

export type NavGroup = { id: string; title: Label; items: NavEntry[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'start',
    title: { ru: 'Начало работы', en: 'Get started', ro: 'Primii pași' },
    items: [
      { kind: 'home', icon: Home, label: { ru: 'Обзор', en: 'Overview', ro: 'Prezentare' } },
      { kind: 'guide', slug: 'getting-started', icon: Zap, label: { ru: 'Первый платёж', en: 'First payment', ro: 'Prima plată' } },
      { kind: 'guide', slug: 'integration-options', icon: LayoutGrid, label: { ru: 'Способы интеграции', en: 'Integration options', ro: 'Moduri de integrare' } },
      { kind: 'guide', slug: 'testing', icon: FlaskConical, label: { ru: 'Тестирование', en: 'Testing', ro: 'Testare' } },
    ],
  },
  {
    id: 'integration',
    title: { ru: 'Интеграция', en: 'Integration', ro: 'Integrare' },
    items: [
      { kind: 'guide', slug: 'server-to-server', icon: Server, label: { ru: 'Server-to-server', en: 'Server-to-server', ro: 'Server-to-server' } },
      { kind: 'guide', slug: 'hosted-checkout', icon: Code, label: { ru: 'Hosted checkout', en: 'Hosted checkout', ro: 'Hosted checkout' } },
      { kind: 'guide', slug: 'notifications', icon: Bell, label: { ru: 'Уведомления', en: 'Notifications', ro: 'Notificări' } },
      { kind: 'guide', slug: 'signatures', icon: KeyRound, label: { ru: 'Подписи', en: 'Signatures', ro: 'Semnături' } },
      { kind: 'guide', slug: 'saved-cards', icon: CreditCard, label: { ru: 'Сохранённые карты', en: 'Saved cards', ro: 'Carduri salvate' } },
      { kind: 'guide', slug: 'errors-and-statuses', icon: Info, label: { ru: 'Статусы и ошибки', en: 'Statuses and errors', ro: 'Statusuri și erori' } },
      { kind: 'guide', slug: 'example-shop', icon: ShoppingCart, label: { ru: 'Пример магазина', en: 'Example shop', ro: 'Magazin exemplu' } },
      { kind: 'guide', slug: 'go-live', icon: Check, label: { ru: 'Выход в production', en: 'Go live', ro: 'Lansare în producție' } },
    ],
  },
  {
    id: 'help',
    title: { ru: 'Справка', en: 'Help', ro: 'Ajutor' },
    items: [
      { kind: 'page', page: 'plugins', icon: Puzzle, label: { ru: 'Плагины', en: 'Plugins', ro: 'Pluginuri' } },
      { kind: 'guide', slug: 'ai-assistants', icon: Bot, label: { ru: 'AI-ассистенты', en: 'AI assistants', ro: 'Asistenți AI' } },
      { kind: 'guide', slug: 'faq', icon: HelpCircle, label: { ru: 'Частые вопросы', en: 'FAQ', ro: 'Întrebări frecvente' } },
      { kind: 'guide', slug: 'changelog', icon: History, label: { ru: 'Изменения', en: 'Changelog', ro: 'Modificări' } },
    ],
  },
];

/** Icon for a guide that is not listed above. */
export const FALLBACK_ICON: LucideIcon = FileText;
