import React from "react";

interface MarkdownMessageProps {
  text:   string;
  isUser: boolean;
}

function parseInline(text: string, isUser: boolean, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const full = match[0];
    if (full.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${match.index}`} className="font-semibold">
          {match[2]}
        </strong>
      );
    } else if (full.startsWith("*")) {
      nodes.push(
        <em key={`${keyPrefix}-i-${match.index}`} className="italic">
          {match[3]}
        </em>
      );
    } else if (full.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${match.index}`}
          className={`text-xs font-mono px-1 py-0.5 rounded ${
            isUser ? "bg-green-800 text-green-100" : "bg-gray-100 text-gray-800"
          }`}
        >
          {match[4]}
        </code>
      );
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

export default function MarkdownMessage({ text, isUser }: MarkdownMessageProps) {
  if (!text) return null;

  const sanitized = text.replace(/<[^>]*>/g, "");

  const lines  = sanitized.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  const codeTextClass = isUser ? "text-green-100" : "text-gray-800";
  const mutedClass    = isUser ? "text-green-200" : "text-gray-500";
  const hrClass       = isUser ? "border-green-500" : "border-gray-200";

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={`code-${i}`}
          className={`text-xs font-mono rounded-lg p-3 my-1 overflow-x-auto whitespace-pre-wrap ${
            isUser ? "bg-green-800 text-green-100" : "bg-gray-100 text-gray-800"
          }`}
        >
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${i}`} className={`my-2 border-t ${hrClass}`} />);
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level   = headingMatch[1].length;
      const content = headingMatch[2];
      const sizeClass = level === 1 ? "text-base" : level === 2 ? "text-sm" : "text-sm";
      blocks.push(
        <p
          key={`h-${i}`}
          className={`font-bold ${sizeClass} mt-2 mb-0.5`}
        >
          {parseInline(content, isUser, `h-${i}`)}
        </p>
      );
      i++;
      continue;
    }

    if (/^[\-\*]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[\-\*]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^[\-\*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-1 space-y-0.5 pl-2">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className={`mt-1.5 w-1 h-1 rounded-full flex-shrink-0 ${
                isUser ? "bg-green-200" : "bg-gray-400"
              }`} />
              <span>{parseInline(item, isUser, `ul-${i}-${idx}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      let   counter = 1;
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-1 space-y-0.5 pl-2">
          {listItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className={`flex-shrink-0 text-xs font-medium min-w-[1rem] ${mutedClass}`}>
                {counter++ + "."}
              </span>
              <span>{parseInline(item, isUser, `ol-${i}-${idx}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {parseInline(line, isUser, `p-${i}`)}
      </p>
    );
    i++;
  }

  return (
    <div className={`text-sm space-y-0.5 ${codeTextClass}`}>
      {blocks}
    </div>
  );
}
