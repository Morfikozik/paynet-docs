import React from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * Small, dependency-free Markdown renderer for the guide pages.
 * Supports what the guides use: headings, paragraphs, lists, tables,
 * fenced code blocks, block quotes (callouts), horizontal rules and
 * inline code / bold / italic / links. Raw HTML is never rendered.
 */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' };

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));

const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);

export const parseMarkdown = (source: string): Block[] => {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ kind: 'code', lang: fence[1] || '', code: code.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ kind: 'hr' });
      i += 1;
      continue;
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ kind: 'quote', text: quote.join('\n') });
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const items: string[] = [];
      while (i < lines.length) {
        const item = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (item) {
          const nested = item[1].length >= 2;
          const text = item[3].replace(/^\[ \]\s+/, '\u2610 ').replace(/^\[x\]\s+/i, '\u2611 ');
          items.push(nested ? `\u00a0\u00a0\u00a0\u00a0\u2022 ${text}` : text);
          i += 1;
        } else if (lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && items.length) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i += 1;
        } else {
          break;
        }
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith('|')
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
};

interface InlineProps {
  text: string;
  onNavigate?: (href: string) => void;
}

const Inline: React.FC<InlineProps> = ({ text, onNavigate }) => {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-paynet-gray-100 text-paynet-gray-800 font-mono text-[0.85em] break-words">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-semibold text-paynet-gray-900">
          <Inline text={token.slice(2, -2)} onNavigate={onNavigate} />
        </strong>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const label = linkMatch ? linkMatch[1] : token;
      const href = linkMatch ? linkMatch[2] : '#';
      const isInternal = href.startsWith('#');
      nodes.push(
        <a
          key={key++}
          href={href}
          onClick={(event) => {
            if (isInternal && onNavigate) {
              event.preventDefault();
              onNavigate(href);
            }
          }}
          target={isInternal ? undefined : '_blank'}
          rel={isInternal ? undefined : 'noopener noreferrer'}
          className="text-paynet-primary hover:text-paynet-secondary underline underline-offset-2"
        >
          <Inline text={label} onNavigate={onNavigate} />
        </a>
      );
    } else {
      nodes.push(
        <em key={key++}>
          <Inline text={token.slice(1, -1)} onNavigate={onNavigate} />
        </em>
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
};

const CodeBlock: React.FC<{ code: string; lang: string }> = ({ code, lang }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="relative group mb-5">
      <div className="flex items-center justify-between bg-paynet-gray-800 text-paynet-gray-300 text-xs px-4 py-1.5 rounded-t-paynet font-mono">
        <span>{lang || 'text'}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1 hover:text-white transition-colors">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-paynet-gray-900 text-paynet-gray-100 p-4 rounded-b-paynet overflow-x-auto text-[13px] leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const calloutStyle = (text: string) => {
  const lowered = text.toLowerCase();
  if (/^\*\*(draft|черновик|ciornă)/.test(lowered)) return 'bg-paynet-orange-light border-paynet-orange text-paynet-gray-800';
  if (/^\*\*(important|warning|важно|внимание|important)/.test(lowered)) return 'bg-red-50 border-paynet-error text-paynet-gray-800';
  return 'bg-paynet-light border-paynet-primary text-paynet-gray-700';
};

interface MarkdownProps {
  source: string;
  onNavigate?: (href: string) => void;
}

export const Markdown: React.FC<MarkdownProps> = ({ source, onNavigate }) => {
  const blocks = React.useMemo(() => parseMarkdown(source), [source]);

  return (
    <div className="guide-content text-paynet-gray-700 leading-relaxed">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading': {
            const id = slugify(block.text);
            if (block.level === 1) {
              return (
                <h1 key={index} id={id} className="text-2xl sm:text-3xl font-bold text-paynet-primary mb-4">
                  <Inline text={block.text} onNavigate={onNavigate} />
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2 key={index} id={id} className="text-xl sm:text-2xl font-semibold text-paynet-primary mt-10 mb-4 pb-2 border-b border-paynet-gray-200">
                  <Inline text={block.text} onNavigate={onNavigate} />
                </h2>
              );
            }
            if (block.level === 3) {
              return (
                <h3 key={index} id={id} className="text-lg font-semibold text-paynet-gray-800 mt-7 mb-3">
                  <Inline text={block.text} onNavigate={onNavigate} />
                </h3>
              );
            }
            return (
              <h4 key={index} id={id} className="text-base font-semibold text-paynet-gray-800 mt-5 mb-2">
                <Inline text={block.text} onNavigate={onNavigate} />
              </h4>
            );
          }
          case 'paragraph':
            return (
              <p key={index} className="mb-4">
                <Inline text={block.text} onNavigate={onNavigate} />
              </p>
            );
          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul';
            return (
              <ListTag key={index} className={`${block.ordered ? 'list-decimal' : 'list-disc'} pl-6 mb-4 space-y-1.5`}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className={item.startsWith('\u00a0') || /^[\u2610\u2611] /.test(item) ? 'list-none -ml-4' : ''}>
                    <Inline text={item} onNavigate={onNavigate} />
                  </li>
                ))}
              </ListTag>
            );
          }
          case 'code':
            return <CodeBlock key={index} code={block.code} lang={block.lang} />;
          case 'table':
            return (
              <React.Fragment key={index}>
              {/* Phones: each row as a card (first cell = title, other cells = "header: value"). */}
              <div className="sm:hidden mb-5 space-y-2">
                {block.rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="border border-paynet-gray-200 rounded-paynet bg-white px-3 py-2.5 text-sm">
                    <div className="font-semibold text-paynet-gray-900 mb-1 break-words">
                      <Inline text={row[0] || ''} onNavigate={onNavigate} />
                    </div>
                    {row.slice(1).map((cell, cellIndex) =>
                      cell.trim() && cell.trim() !== '—' ? (
                        <div key={cellIndex} className="mt-1 break-words">
                          {block.header[cellIndex + 1] && (
                            <span className="text-paynet-gray-500 text-xs uppercase tracking-wide block">
                              <Inline text={block.header[cellIndex + 1]} onNavigate={onNavigate} />
                            </span>
                          )}
                          <span className="text-paynet-gray-800">
                            <Inline text={cell} onNavigate={onNavigate} />
                          </span>
                        </div>
                      ) : null
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto mb-5 border border-paynet-gray-200 rounded-paynet">
                <table className="min-w-full text-sm">
                  <thead className="bg-paynet-light">
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex} className="text-left font-semibold text-paynet-gray-800 px-3 py-2 border-b border-paynet-gray-200 whitespace-nowrap">
                          <Inline text={cell} onNavigate={onNavigate} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="odd:bg-white even:bg-paynet-gray-50 align-top">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 border-b border-paynet-gray-100">
                            <Inline text={cell} onNavigate={onNavigate} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </React.Fragment>
            );
          case 'quote':
            return (
              <div key={index} className={`border-l-4 rounded-r-paynet px-4 py-3 mb-5 ${calloutStyle(block.text)}`}>
                {block.text.split(/\n{2,}/).map((part, partIndex) => (
                  <p key={partIndex} className="mb-1 last:mb-0">
                    <Inline text={part.replace(/\n/g, ' ')} onNavigate={onNavigate} />
                  </p>
                ))}
              </div>
            );
          case 'hr':
            return <hr key={index} className="my-8 border-paynet-gray-200" />;
          default:
            return null;
        }
      })}
    </div>
  );
};
