import { ipcMain as s, dialog as d, BrowserWindow as u, app as f } from "electron";
import { fileURLToPath as _ } from "node:url";
import a from "node:path";
import l from "node:fs";
import g from "node:os";
const p = a.dirname(_(import.meta.url));
process.env.APP_ROOT = a.join(p, "..");
const m = process.env.VITE_DEV_SERVER_URL, x = a.join(process.env.APP_ROOT, "dist-electron"), h = a.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = m ? a.join(process.env.APP_ROOT, "public") : h;
let t;
function w() {
  t = new u({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    frame: !1,
    // Убираем системную рамку
    titleBarStyle: "hidden",
    // Скрываем заголовок
    icon: a.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: a.join(p, "preload.mjs"),
      contextIsolation: !0,
      // Изоляция контекста (безопасность)
      nodeIntegration: !1
      // Запрет прямого доступа к Node.js
    }
  }), m ? t.loadURL(m) : t.loadFile(a.join(h, "index.html"));
}
function y(i) {
  try {
    const r = l.readdirSync(i, { withFileTypes: !0 }), o = [];
    for (const e of r) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const n = a.join(i, e.name);
      if (e.isDirectory()) {
        const c = y(n);
        c.length > 0 && o.push({
          name: e.name,
          path: n,
          isDirectory: !0,
          children: c
        });
      } else e.name.endsWith(".md") && o.push({
        name: e.name,
        path: n,
        isDirectory: !1
      });
    }
    return o.sort((e, n) => e.isDirectory && !n.isDirectory ? -1 : !e.isDirectory && n.isDirectory ? 1 : e.name.localeCompare(n.name));
  } catch {
    return [];
  }
}
s.handle("fs:readFile", async (i, r) => l.readFileSync(r, "utf-8"));
s.handle("fs:writeFile", async (i, r, o) => {
  l.writeFileSync(r, o, "utf-8");
});
s.handle("fs:readDir", async (i, r) => y(r));
s.handle("dialog:openFolder", async () => {
  const i = await d.showOpenDialog({
    properties: ["openDirectory"],
    title: "Выберите рабочую папку"
  });
  return i.canceled || i.filePaths.length === 0 ? null : i.filePaths[0];
});
s.handle("dialog:openFile", async () => {
  const i = await d.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md"] }],
    title: "Открыть Markdown-файл"
  });
  if (i.canceled || i.filePaths.length === 0) return null;
  const r = i.filePaths[0], o = l.readFileSync(r, "utf-8");
  return { filePath: r, content: o };
});
s.handle("export:html", async (i, r, o) => {
  const e = await d.showSaveDialog(t, {
    title: "Экспорт в HTML",
    defaultPath: o,
    filters: [{ name: "HTML Document", extensions: ["html"] }]
  });
  if (e.canceled || !e.filePath) return !1;
  try {
    return l.writeFileSync(e.filePath, r, "utf-8"), !0;
  } catch (n) {
    return console.error("Ошибка экспорта HTML:", n), !1;
  }
});
s.handle("export:pdf", async (i, r, o) => {
  const e = await d.showSaveDialog(t, {
    title: "Экспорт в PDF",
    defaultPath: o,
    filters: [{ name: "PDF Document", extensions: ["pdf"] }]
  });
  if (e.canceled || !e.filePath) return !1;
  try {
    const n = new u({
      show: !1,
      webPreferences: {
        nodeIntegration: !1,
        contextIsolation: !0
      }
    }), c = a.join(g.tmpdir(), `type_club_export_${Date.now()}.html`);
    l.writeFileSync(c, r, "utf-8"), await n.loadURL(`file://${c}`), await n.webContents.executeJavaScript("document.fonts.ready"), await new Promise((D) => setTimeout(D, 500));
    const P = await n.webContents.printToPDF({
      printBackground: !0,
      pageSize: "A4",
      margins: { marginType: "default" }
    });
    return l.writeFileSync(e.filePath, P), l.unlinkSync(c), n.close(), !0;
  } catch (n) {
    return console.error("Ошибка экспорта PDF:", n), !1;
  }
});
s.on("window:minimize", () => t == null ? void 0 : t.minimize());
s.on("window:maximize", () => {
  t != null && t.isMaximized() ? t.unmaximize() : t == null || t.maximize();
});
s.on("window:close", () => t == null ? void 0 : t.close());
f.on("window-all-closed", () => {
  process.platform !== "darwin" && (f.quit(), t = null);
});
f.on("activate", () => {
  u.getAllWindows().length === 0 && w();
});
f.whenReady().then(w);
export {
  x as MAIN_DIST,
  h as RENDERER_DIST,
  m as VITE_DEV_SERVER_URL
};
