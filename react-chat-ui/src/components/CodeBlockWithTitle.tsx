import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Props {
  title: string;
  language: string;
  code: string;
}

const CodeBlockWithTitle: React.FC<Props> = ({ title, language, code }) => (
  <div className="my-4 rounded-xl border border-gray-700 bg-zinc-900 shadow-md overflow-hidden">
    <div className="bg-zinc-800 px-4 py-2 text-white text-sm font-semibold">{title}</div>
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      showLineNumbers
      customStyle={{ margin: 0, padding: "1rem", background: "#1e1e1e" }}
    >
      {code}
    </SyntaxHighlighter>
  </div>
);

export default CodeBlockWithTitle;