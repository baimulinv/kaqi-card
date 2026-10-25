# 卡期 · GitHub Pages 部署版 (v1.0.1)

## 你需要的只是 GitHub 仓库，不需要 Railway

将**本文件夹内**的网页文件上传到一个 GitHub 仓库的**根目录**（根目录中要直接看到 `index.html`，而不是再多一层文件夹）。

### 用 GitHub 网页操作

1. 在 github.com 登录你的账号，点击右上角 `+` → `New repository`。
2. 仓库名建议 `kaqi-card`，选择 **Public**；不要在仓库中放银行凭证、卡号或其他私密文件。创建仓库。
3. 进入仓库，点击 `Add file` → `Upload files`（空仓库可能显示 `uploading an existing file`）。将解压后的 `index.html`、`app.js`、`logic.js`、`style.css`、`manifest.webmanifest`、`sw.js`、`icons` 文件夹上传到仓库根目录并提交；`.nojekyll` 可选。注意：**直接上传 ZIP 压缩包不会变成网站，需要先解压**。
4. 仓库 → `Settings` → `Pages` → `Build and deployment`：`Source` 选 `Deploy from a branch`，分支 `main`，目录 `/(root)`，按 `Save`。
5. GitHub 显示站点发布成功后，回到 `Settings → Pages` 找到实际网址，通常形如 `https://你的GitHub用户名.github.io/kaqi-card/`。这只是示例模板，并非当前已部署的网站。
6. iPhone 上使用 Safari 打开实际网址，点击 `分享` → `添加到主屏幕`，以后点桌面「卡期」即可。

## 可以用什么

- 今日最佳信用卡、未来日期查看、月度还款记录、已还款标记、导入导出备份、导出 ICS 还款日历。
- 网站可作为 PWA 安装到手机主屏幕，访问过后可在离线状态下使用部分功能。
- 本版数据仅保存在当前设备 Safari 的本地存储中，**不是 GitHub 账号同步**。备份尤其重要，换设备、换域名或清理数据需要恢复备份。

## GitHub Pages 的局限

GitHub Pages 只能托管静态网页，没有可以常驻的 Node 服务器，因此**关闭网页后不能自动在指定日期发送声音推送**。本版设置中的推送按钮已禁用，避免误导。请启用银行 App 自带的还款提醒，或导出日历作为备用；如后期需要真正声音推送，可再配合后端服务升级。

导出的 ICS 日历事件由手机日历独立管理：**在卡期点击「已还款」不会自动删除之前导入的日历提醒**，须自行在日历里处理。

## 数据安全

- 不要在 GitHub 仓库提交真实卡号、身份证、短信验证码、银行密码、账单导出数据、`.env` 或服务器推送密钥。
- 放在 GitHub 上的只有程序代码，用户录入的卡片内容不会因为打开网站而公开到仓库。
- 普通 GitHub Pages 站点不等于保险级的资金提醒服务；最终还款日以银行账单为准。

## 结构

index.html                  首页，Github Pages 自动访问
style.css / app.js          样式与交互
logic.js                    账单日、还款日计算
manifest.webmanifest        PWA 应用身份与安装配置
sw.js                       离线缓存
icons/                      桌面图标
.nojekyll                   跳过不必要的 Jekyll 静态构建
