# 项目名称: AWS认证模拟考试系统

[**项目地址**](https://github.com/ryang420/exam-mimic)

## 本地开发

### 环境准备

- 安装 [Node.js](https://nodejs.org/en)
- 安装 [pnpm](https://pnpm.io/installation)

### 操作步骤

- 安装依赖

```sh
pnpm install
```

- 复制 .env.example 文件为 .env 文件

```sh
cp .env.example .env
```

- 修改 .env 文件中的 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY

```sh
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

- 启动 Dev Server

```sh
pnpm run dev
```

- 在浏览器访问 http://localhost:3000
