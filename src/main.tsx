import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

function BrowserOnlyNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Electron Runtime Required</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page is only the renderer dev server. The actual desktop app must be opened through Electron.
        </p>
        <div className="mt-4 rounded-lg bg-muted p-4 font-mono text-sm text-foreground">
          npm run dev:desktop
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          If you opened <code>127.0.0.1</code> in a normal browser, that is expected to not work as the full app.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  window.desktopApi ? <App /> : <BrowserOnlyNotice />
);
