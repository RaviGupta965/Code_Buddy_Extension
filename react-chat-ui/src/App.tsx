import { useEffect, useRef, useState } from 'react';
import CodeBlockWithTitle from "./components/CodeBlockWithTitle";
import { extractLabeledCodeBlocks } from "./utils/parseCodeBlock";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { CodeSnippet } from "./utils/parseCodeBlock";
import './App.css';

declare global {
  interface Window {
    vscode: any;
  }
}

declare function acquireVsCodeApi(): any;

interface ChatEntry {
  userQuery: string;
  aiResponse: string;
  codeSnippets: CodeSnippet[];
}

interface AttachedFile {
  filename: string;
  content: string;
}

function App() {
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile | null>(null);

  useEffect(() => {
    window.vscode = acquireVsCodeApi();

    window.addEventListener("message", (event) => {
      const message = event.data;

      if (message.type === "attachedFiles") {
        const file = message.files?.[0];
        if (file) {
          setAttachedFiles(file);
        } // [{ filename, content }]
      }

      if (message.type === "aiResponse") {
        const rawText = message?.text ? message?.text : 'Thinking';
        const blocks = extractLabeledCodeBlocks(rawText);

        setHistory((prev) => {
          const last = prev[prev.length - 1];
          const updated = [...prev.slice(0, -1), {
            ...last,
            aiResponse: rawText,
            codeSnippets: blocks
          }];
          return updated;
        });
      }
    });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleSend = () => {
    if (input.trim() === '') return;

    window.vscode.postMessage({
      type: 'userMessage',
      text: input,
      files: attachedFiles ? attachedFiles : [],
    });

    setHistory((prev) => [...prev, { userQuery: input, aiResponse: '', codeSnippets: [] }]);
    setInput('');
    setAttachedFiles(null); // clear files after sending
  };

  const handleAttachClick = () => {
    window.vscode.postMessage({ type: "pickFile" });
  };

  return (
    <div className="h-screen w-full bg-purple-900 text-white flex flex-col p-4 font-sans">
      <h2 className="text-xl font-bold mb-4">VS Code AI Chat</h2>

      <div className="flex-1 overflow-y-auto bg-gray-800 rounded p-4 space-y-6">
        {history.map((entry, idx) => (
          <div key={idx} className="space-y-2">
            <div>
              <span className="font-semibold text-blue-400">You:</span> {entry.userQuery}
            </div>
            <div>
              <span className="font-semibold text-green-400">AI:</span>
              <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                {entry.aiResponse}
              </ReactMarkdown>
            </div>
            {entry.codeSnippets.map((snippet, i) => (
              <CodeBlockWithTitle
                key={i}
                title={snippet.title}
                language={snippet.language}
                code={snippet.code}
              />
            ))}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {attachedFiles && (
        <div className="mt-2 text-sm text-gray-300">
          📎 Attached: {attachedFiles.filename}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 p-2 rounded bg-gray-700 text-white outline-none"
          placeholder="Type your message..."
        />
        <button onClick={handleAttachClick} title="Attach File">📎</button>
        <button
          onClick={handleSend}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;


