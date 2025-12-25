import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// 取得 __dirname (ESM workaround)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定路徑
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'dist');
const deployTargetRoot = path.resolve(projectRoot, '../radtools.tsai.it/random-duty');
const packageJsonPath = path.resolve(projectRoot, 'package.json');

// 讀取 package.json
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = pkg.version;
const deployTargetVer = path.resolve(deployTargetRoot, 'ver', version);

// Helper function to execute shell commands with output
function run(command) {
    console.log(`[36m> ${command}[0m`); // Cyan color
    try {
        execSync(command, { stdio: 'inherit', cwd: projectRoot });
    } catch (error) {
        console.error(`[31mCommand failed: ${command}[0m`);
        process.exit(1);
    }
}

console.log(`[33m=== Starting Deployment for v${version} ===[0m`);

// 1. 檢查目標目錄是否存在
if (!fs.existsSync(deployTargetRoot)) {
    console.error(`[31mError: Target directory not found: ${deployTargetRoot}[0m`);
    console.error('Please check if the path is correct and the repository is checked out.');
    process.exit(1);
}

// 2. 執行 Build
console.log('\n\u001B[32m[1/4] Building project...\u001B[0m');
run('npm run build');

// 3. 同步到根目錄 (保留 ver 目錄)
console.log(`\n\u001B[32m[2/4] Deploying to Root: ${deployTargetRoot}\u001B[0m`);
// rsync options:
// -a: archive mode (recursive, preserves permissions, times, etc.)
// -v: verbose
// --delete: delete extraneous files from dest dirs (clean up old hashes)
// --exclude 'ver': IMPORTANT! Do not delete or touch the 'ver' directory
const rsyncRootCmd = `rsync -av --delete --exclude 'ver' "${distDir}/" "${deployTargetRoot}/"`;
run(rsyncRootCmd);

// 4. 準備版本目錄
console.log(`\n\u001B[32m[3/4] Preparing Version Directory: ${deployTargetVer}\u001B[0m`);
if (!fs.existsSync(deployTargetVer)) {
    fs.mkdirSync(deployTargetVer, { recursive: true });
}

// 5. 同步到版本目錄
console.log(`\n\u001B[32m[4/4] Deploying to Version: ${deployTargetVer}\u001B[0m`);
// 這裡不需要 exclude ver，因為目標本身就是 ver/x.x.x
const rsyncVerCmd = `rsync -av --delete "${distDir}/" "${deployTargetVer}/"`;
run(rsyncVerCmd);

// 6. 執行 Git Commit & Push
console.log(`\n\x1b[32m[5/5] Committing and Pushing to Remote...\x1b[0m`);

// 確保我們在目標的 git repo 根目錄 (可能是 random-duty 本身，或是 radtools.tsai.it)
// 根據您的描述，目標路徑是 radtools.tsai.it/random-duty
// 我們需要確認 git root 在哪裡。
// 假設 radtools.tsai.it 整個資料夾是一個 git repo，或者 random-duty 是一個 submodule 或獨立 repo。
// 最安全的做法是在 deployTargetRoot 執行 git 命令。

const gitCommitMsg = `Deploy v${version} - ${new Date().toLocaleString()}`;

try {
    // Check status
    // -C <path> 讓 git 在指定目錄下執行
    execSync(`git -C "${deployTargetRoot}" add .`, { stdio: 'inherit' });
    
    // 檢查是否有變更需要 commit
    const status = execSync(`git -C "${deployTargetRoot}" status --porcelain`, { encoding: 'utf-8' });
    
    if (status.trim()) {
        console.log(`Creating commit with message: "${gitCommitMsg}"`);
        execSync(`git -C "${deployTargetRoot}" commit -m "${gitCommitMsg}"`, { stdio: 'inherit' });
        
        console.log('Pushing changes...');
        execSync(`git -C "${deployTargetRoot}" push`, { stdio: 'inherit' });
        console.log(`\x1b[32mGit push successful!\x1b[0m`);
    } else {
        console.log(`\x1b[33mNo changes detected in deployment directory. Skipping commit/push.\x1b[0m`);
    }
} catch (error) {
    console.error(`\x1b[31mGit operations failed in ${deployTargetRoot}\x1b[0m`);
    console.error(error);
    process.exit(1);
}

console.log(`\n\x1b[32m=== Deployment Complete Successfully! ===\x1b[0m`);
console.log(`Live:   ${deployTargetRoot}`);
console.log(`Backup: ${deployTargetVer}`);
