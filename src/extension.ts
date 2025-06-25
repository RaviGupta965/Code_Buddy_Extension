import { GoogleGenerativeAI } from "@google/generative-ai";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log("VS Code AI Chat Extension is now active!");

  
  let disposable = vscode.commands.registerCommand(
    "code-buddy.openChat",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "aiChat",
        "AI Chat Assistant",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          enableCommandUris: true, // <- important if needed
          localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, "media")),
          ],
        }
      );
      vscode.window.showInformationMessage("Webview content loaded.");
      panel.webview.html = getWebviewContent(context, panel);

      panel.webview.onDidReceiveMessage(
        async (message) => {
          if (message.type === "userMessage") {
            const query = message.text;
            const attachedFiles = message.files || [];

            // ⬇️ Add attached file content to the prompt
            let fileContext = "";
            for (const file of attachedFiles) {
              fileContext += `File: ${file.filename}\nContent:\n${file.content}\n\n`;
            }

            const queryWithFileContext =
              fileContext + (await injectFileContext(query));
            const aiText = await generateAIResponse(queryWithFileContext);

            panel.webview.postMessage({ type: "aiResponse", text: aiText });
          }

          if (message.type === "pickFile") {
            try {
              console.log("📎 IN PICK FILE");
              const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: "Attach",
                filters: {
                  "Code files": [
                    "js",
                    "ts",
                    "jsx",
                    "tsx",
                    "json",
                    "html",
                    "css",
                    "py",
                    "java",
                    "cpp",
                  ],
                  "All files": ["*"],
                },
              });

              if (uris && uris.length > 0) {
                const fileContents = await Promise.all(
                  uris.map(async (uri) => {
                    const content = await vscode.workspace.fs.readFile(uri);
                    return {
                      filename: path.basename(uri.fsPath),
                      content: Buffer.from(content).toString("utf8"),
                    };
                  })
                );

                panel.webview.postMessage({
                  type: "attachedFiles",
                  files: fileContents,
                });
              }
            } catch (err) {
              console.error("❌ Error while picking file:", err);
              vscode.window.showErrorMessage(
                "Failed to attach file. See console for details."
              );
            }
          }
        },
        undefined,
        context.subscriptions
      );
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

// Getting the content entered by the user
function getWebviewContent(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): string {
  const reactAppPath = vscode.Uri.file(path.join(context.extensionPath, "media", "index.html"));
  let html = fs.readFileSync(reactAppPath.fsPath, "utf8");

  // Inject CSP header into <head>
  const csp = `
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      img-src vscode-resource: https:;
      script-src 'unsafe-inline' vscode-resource:;
      style-src 'unsafe-inline' vscode-resource:;
    ">
  `;

  html = html.replace(/<head>(.*?)<\/head>/s, `<head>$1${csp}</head>`);

  html = html.replace(/(src|href)="(.+?)"/g, (match, p1, p2) => {
    const resourcePath = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, "media", p2))
    );
    return `${p1}="${resourcePath}"`;
  });

  return html;
}

// giving query to the AI MODEL
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
async function generateAIResponse(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err: any) {
    console.error(err);
    return "⚠️ AI Error: Rate limit hit or model unavailable. Try again later.";
  }
}

// code for injecting file
async function injectFileContext(query: string): Promise<string> {
  const fileMentionRegex = /@(\S+\.\w+)/g;
  let match;
  let context = "";

  while ((match = fileMentionRegex.exec(query)) !== null) {
    const filename = match[1];
    const files = await vscode.workspace.findFiles(
      `**/${filename}`,
      "**/node_modules/**",
      1
    );
    if (files.length > 0) {
      const fileUri = files[0];
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      context += `File: ${filename}\nContent:\n${Buffer.from(
        fileContent
      ).toString("utf8")}\n\n`;
    }
  }

  return `${context}User Query:\n${query}`;
}
