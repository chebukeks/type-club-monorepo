import { ipcMain, dialog, app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    // Убираем системную рамку
    titleBarStyle: "hidden",
    // Скрываем заголовок
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      // Изоляция контекста (безопасность)
      nodeIntegration: false
      // Запрет прямого доступа к Node.js
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
function readDirRecursive(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const children = readDirRecursive(fullPath);
        if (children.length > 0) {
          result.push({
            name: entry.name,
            path: fullPath,
            isDirectory: true,
            children
          });
        }
      } else if (entry.name.endsWith(".md")) {
        result.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false
        });
      }
    }
    return result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}
ipcMain.handle("fs:readFile", async (_event, filePath) => {
  return fs.readFileSync(filePath, "utf-8");
});
ipcMain.handle("fs:writeFile", async (_event, filePath, content) => {
  fs.writeFileSync(filePath, content, "utf-8");
});
ipcMain.handle("fs:readDir", async (_event, dirPath) => {
  return readDirRecursive(dirPath);
});
ipcMain.handle("dialog:openFolder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Выберите рабочую папку"
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
ipcMain.handle("dialog:openFile", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md"] }],
    title: "Открыть Markdown-файл"
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, "utf-8");
  return { filePath, content };
});
ipcMain.on("window:minimize", () => win == null ? void 0 : win.minimize());
ipcMain.on("window:maximize", () => {
  if (win == null ? void 0 : win.isMaximized()) {
    win.unmaximize();
  } else {
    win == null ? void 0 : win.maximize();
  }
});
ipcMain.on("window:close", () => win == null ? void 0 : win.close());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
