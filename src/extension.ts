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
        { enableScripts: true }
      );
      vscode.window.showInformationMessage("Webview content loaded.");
      panel.webview.html = getWebviewContent(context, panel);
      panel.webview.onDidReceiveMessage(
        async (message) => {
          if (message.type === "userMessage") {
            const query = message.text;

            // Optional: Detect and load @filename content
            const processedPrompt = await injectFileContext(query);

            const aiText = await generateAIResponse(processedPrompt);
            
            panel.webview.postMessage({ type: "aiResponse", text: aiText });
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
function getWebviewContent(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel
): string {
  const reactAppPath = vscode.Uri.file(
    path.join(context.extensionPath, "media", "index.html")
  );
  let html = fs.readFileSync(reactAppPath.fsPath, "utf8");

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
    returresponse;
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
