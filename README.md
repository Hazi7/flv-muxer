# flv-muxer

A lightweight FLV muxer library for JavaScript/TypeScript

## 安装

```bash
npm install flv-muxer
```

## 使用

[使用示例和文档]

## 发布指南

### 发布新版本

1. 确保所有更改已提交并推送到主分支
2. 使用语义化版本号创建git标签
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. GitHub Actions将自动执行以下操作：
   - 运行测试
   - 构建项目
   - 发布到npm
   - 创建GitHub Release

### 发布前的准备

- 确保 `package.json` 中的版本号已更新
- 运行并通过所有测试 `npm test`
- 构建项目 `npm run build`

### npm发布凭证

发布需要在GitHub仓库的Secrets中配置 `NPM_TOKEN`。可以在npm个人资料设置中生成。

## 许可证

ISC
