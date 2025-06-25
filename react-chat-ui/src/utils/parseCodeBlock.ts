export interface CodeSnippet {
  title: string;
  language: string;
  code: string;
}

export function extractLabeledCodeBlocks(response: string): CodeSnippet[] {
  const lines = response.split("\n");
  const snippets: CodeSnippet[] = [];

  let currentTitle = "";
  let insideCode = false;
  let codeLang = "";
  let codeLines: string[] = [];

  for (let line of lines) {
    const titleMatch = line.match(/^\*\*(.*?)\*\*/);
    if (titleMatch && !insideCode) {
      currentTitle = titleMatch[1];
      continue;
    }

    if (line.startsWith("```")) {
      if (!insideCode) {
        insideCode = true;
        codeLang = line.replace("```", "").trim() || "plaintext";
        codeLines = [];
      } else {
        insideCode = false;
        snippets.push({
          title: currentTitle,
          language: codeLang,
          code: codeLines.join("\n").trim(),
        });
      }
      continue;
    }

    if (insideCode) codeLines.push(line);
  }

  return snippets;
}
