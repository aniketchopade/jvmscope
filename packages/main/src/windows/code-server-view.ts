import { WebContentsView, type BrowserWindow, type Rectangle } from "electron";

/**
 * Manages one WebContentsView per session, each loaded with that session's code-server URL.
 * Uses WebContentsView (the current Electron API — BrowserView is deprecated as of Electron 30+)
 * attached to the main window's contentView and positioned to overlay a placeholder <div> in
 * the renderer; the renderer reports that div's bounds via IPC on mount/resize/tab-change,
 * see EditorPane.tsx.
 * Only one session's view is attached/visible at a time; switching tabs detaches the previous
 * one rather than destroying it, so re-selecting a tab is instant.
 */
export class CodeServerViewManager {
  private views = new Map<string, WebContentsView>();
  private activeSessionId?: string;

  constructor(private readonly window: BrowserWindow) {}

  private getOrCreate(sessionId: string, url: string): WebContentsView {
    let view = this.views.get(sessionId);
    if (!view) {
      view = new WebContentsView({
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      void view.webContents.loadURL(url);
      this.views.set(sessionId, view);
    }
    return view;
  }

  show(sessionId: string, url: string, bounds: Rectangle): void {
    if (this.activeSessionId && this.activeSessionId !== sessionId) {
      const previous = this.views.get(this.activeSessionId);
      if (previous) this.window.contentView.removeChildView(previous);
    }

    const view = this.getOrCreate(sessionId, url);
    this.window.contentView.addChildView(view);
    view.setBounds(bounds);
    this.activeSessionId = sessionId;
  }

  setBounds(sessionId: string, bounds: Rectangle): void {
    const view = this.views.get(sessionId);
    if (view && this.activeSessionId === sessionId) view.setBounds(bounds);
  }

  hide(sessionId: string): void {
    const view = this.views.get(sessionId);
    if (view) this.window.contentView.removeChildView(view);
    if (this.activeSessionId === sessionId) this.activeSessionId = undefined;
  }

  close(sessionId: string): void {
    const view = this.views.get(sessionId);
    if (!view) return;
    this.window.contentView.removeChildView(view);
    view.webContents.close();
    this.views.delete(sessionId);
    if (this.activeSessionId === sessionId) this.activeSessionId = undefined;
  }
}
