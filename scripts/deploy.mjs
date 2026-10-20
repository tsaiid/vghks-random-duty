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

// Helper function to execute shell commands with output
function run(command) {
    console.log(`\x1b[36m> ${command}\x1b[0m`); // Cyan color
    try {
        execSync(command, { stdio: 'inherit', cwd: projectRoot });
    } catch (error) {
        console.error(`\x1b[31mCommand failed: ${command}\x1b[0m`);
        process.exit(1);
    }
}

console.log(`\x1b[33m=== Starting Deployment for v${version} ===\x1b[0m`);

// 1. 檢查目標目錄是否存在
if (!fs.existsSync(deployTargetRoot)) {
    console.error(`\x1b[31mError: Target directory not found: ${deployTargetRoot}\x1b[0m`);
    console.error('Please check if the path is correct and the repository is checked out.');
    process.exit(1);
}

// 2. 執行 Test 與 Build
console.log('\n\x1b[32m[1/3] Testing and building project...\x1b[0m');
run('pnpm test');
run('pnpm build');

// 3. 同步到根目錄 (排除 ver, legacy 與 .git)
console.log(`\n\x1b[32m[2/3] Deploying to Root: ${deployTargetRoot}\x1b[0m`);
const rsyncRootCmd = `rsync -av --delete --exclude 'ver' --exclude 'legacy' --exclude '.git' "${distDir}/" "${deployTargetRoot}/"`;
run(rsyncRootCmd);

// 4. 執行 Git Commit & Push
console.log(`\n\x1b[32m[3/3] Committing and Pushing to Remote...\x1b[0m`);
const gitCommitMsg = `Deploy random-duty v${version} - ${new Date().toLocaleString()}`;

try {
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
console.log(`Live: ${deployTargetRoot}`);
