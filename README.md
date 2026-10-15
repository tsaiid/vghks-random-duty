# Random Duty Generator

A single page application to assist resident duty arrangement.

輔助住院醫師排班的網頁版小工具。[Demo Site](https://radtools.tsai.it/random-duty/)

## Feature

1. 從 Google calendar 下載台灣版假日行事曆，如與實際有差異，也可自訂假日。
2. 可設定不值人員。
3. 可依該月總點數（平日及星期五為 1 點，假日為 2 點）產生建議班數分配，也可手動調整。
4. 亂數產生班表，預設為不連值，可設定 qod 值班上限。

## Limitation

1. 因需要大量運算，會用到 Web Workers 技術，故建議使用新版的瀏覽器，IE9 以下並不支援。
2. 無法於網頁版儲存結果，可以 excel 檔或螢幕截圖的方式匯出。
3. 經更動的 google calendar 假日無法永久儲存，若重新整理頁面會失效。

## License

MIT License

## Development

This project uses **pnpm** for package management and **Vite** for development and building.

### Prerequisites

*   [mise](https://mise.jdx.dev/) (推薦，專案已於 `.mise.toml` 鎖定環境版本)
*   或手動安裝：
    *   Node.js (v20+ / v22 LTS 推薦)
    *   pnpm (v9+ 推薦)

### Installation

```bash
# 若使用 mise，自動安裝鎖定的 Node 與 pnpm 版本
mise install

# 安裝專案相依套件
pnpm install
```

### Running Tests

執行單元測試 (Vitest)：

```bash
pnpm test
```

### Local Development

Start the development server with hot module replacement (HMR):

```bash
pnpm dev
```

Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

### Building for Production

Build the project for production. The output files will be in the `dist/` directory:

```bash
pnpm build
```

### Preview Production Build

Preview the production build locally:

```bash
pnpm preview
```

### Deployment

本專案採用 **GitHub Actions** 進行自動化部署至 `radtools.tsai.it`，由 **Git Tag** 觸發：

1. **更新版本號與建立標籤**：
   使用 `pnpm version` 自動同步 `package.json` 版本號並建立 Git Commit 與 Tag：
   ```bash
   pnpm version patch  # 1.1.0 -> 1.1.1 (或 minor / major)
   ```
2. **推送標籤觸發自動部署**：
   ```bash
   git push
   git push --tags
   ```
   GitHub Actions 會自動執行單元測試、檢查版號一致性、打包編譯，並自動推送至 `radtools.tsai.it/random-duty`，同時於 GitHub 建立 Release 附帶 `dist.zip` 備份。

3. **本機備援部署 (手動)**：
   若需在本機直接部署至同層目錄的 `radtools.tsai.it`，可執行：
   ```bash
   pnpm run deploy
   ```

## Project Structure

*   `src/`: Source code
    *   `js/`: JavaScript files (ES Modules)
    *   `css/`: Stylesheets
    *   `img/`: Image assets
*   `dist/`: Production build output
*   `index.html`: Main entry point
*   `vite.config.js`: Vite configuration