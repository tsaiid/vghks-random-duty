# 專案規範與工作流程 (Project Guidelines) - random-duty

## 發行與部署流程 (Release & Deployment Workflow)
- **升版號與部署 (Release & Deploy)**：
  - 本專案已配置 GitHub Actions 自動化部署工作流程（`.github/workflows/deploy.yml`），由 `v*` 格式之 Git Tag 觸發。
  - 當使用者指示「升版號 deploy」或「發行部署」時，標準流程為：
    1. 更新 `package.json` 的 `version` 與 `index.html` 的版本沿革（ChangeLog）。
    2. 建立發行 Commit（例如：`chore(release): 發行 vX.Y.Z`）。
    3. 建立對應版號的 Git Tag（例如：`git tag vX.Y.Z`）。
    4. 將分支與 Tag 推送至 GitHub（`git push origin <branch>` 及 `git push origin vX.Y.Z`）。
    5. 由 GitHub Actions 自動完成測試、建置，並同步發佈至 `radtools.tsai.it`。
    6. **不需**手動執行本機 `scripts/deploy.mjs`。
