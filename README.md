# 永铭 Evermark

**每个人都值得被永远记住 / Everyone deserves to be remembered, forever.**

一个基于 [Irys](https://irys.xyz) 去中心化永久存储的公开纪念空间。为逝去的亲人、挚友或未来的自己建立一座永不消失的数字纪念碑——文字、照片与影像被永久刻录在链上，任何人、任何时候都可以到访、献花、点烛与留言。

A public memorial site built on Irys permanent storage. Create an everlasting digital monument — words, photos and video engraved on-chain, open for anyone to visit and remember. No crypto wallet needed: the site wallet pays for storage.

> 项目调研与客观评价见 [docs/EVALUATION.md](docs/EVALUATION.md)。

## 核心特性

- **真正的永久** — 内容存储于 Irys 网络，不依赖本站存续；每页附「链上验证」链接
- **无门槛** — 无需钱包、无需注册；服务端代付存储费
- **无钱包所有权** — 创建时在浏览器生成 Ed25519 密钥对；纪念空间 ID 由公钥哈希派生，无法被抢注或伪造；持钥可发布新版本
- **缅怀互动** — 访客献花 / 点烛 / 永久留言，均为链上记录
- **上传前审核** — 永久存储无法删除，因此在代付上传前拦截违规内容；站点层签名 hide/unhide 记录（本身也公开上链，可审计）
- **中英双语** — Cookie + Accept-Language 检测，纪念页 URL 全球唯一、不含语言前缀
- **零数据库** — 全部状态在链上：manifest、tribute、moderation、report 皆为带标签的 Irys 记录，站点仅是可替换的读写界面

## 技术栈

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind 4 · @irys/upload · @noble/ed25519 · zod · vitest

## 架构速览

```
浏览器                        Next.js (Vercel)                Irys 网络
──────                       ─────────────────               ─────────
生成密钥对/签名 manifest  →   POST /api/memorial
图片压缩                  →   POST /api/upload    ──代付──→   永久存储 (tx)
                             (审核+限流+校验)                    │
渲染页面   ←──────────────   服务端组件读取      ←─GraphQL─────┘
                             (schema校验+签名验证+隐藏过滤)   gateway 读取数据
```

- 数据模型与信任链：`src/lib/memorial/`（schema.ts 是唯一事实来源；identity.ts 定义 ID 派生与签名验证）
- Irys 读写：`src/lib/irys/`（server.ts 代付上传；query.ts GraphQL 索引）
- 审核与防滥用：`src/lib/moderation/`

## 本地运行

```bash
npm install
cp .env.example .env.local   # 按注释填写
npm run dev
```

最小可用配置（devnet）：

1. `IRYS_PRIVATE_KEY`：任意新生成的 EVM 私钥（见 .env.example 注释）
2. `IRYS_NETWORK=devnet`，`IRYS_RPC_URL` 用 Sepolia 公共 RPC
3. Devnet 上传需要先充值 devnet 余额：领取 [Sepolia 测试币](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)后运行：
   ```bash
   npx @irys/cli fund 100000000000000 -n devnet -t ethereum -w $IRYS_PRIVATE_KEY --provider-url https://ethereum-sepolia-rpc.publicnode.com
   ```
4. 管理功能（可选）：`ADMIN_TOKEN` 任意随机串 + `npm run generate-admin-key` 生成 `MODERATION_ADMIN_SECRET`

测试与构建：

```bash
npm test        # vitest（信任链/审核单测）
npm run build
```

## 部署到 Vercel

1. 导入本仓库，Framework 选 Next.js（默认即可）
2. 配置环境变量（同 `.env.example`）
3. Deploy

### 切换 Mainnet（真·永久存储）

1. 给 `IRYS_PRIVATE_KEY` 对应地址充值 ETH（主网存储约 $2-3/GB，一次付费永久有效）
2. 用 Irys CLI 将 ETH 充入 Irys 余额（`-n mainnet`）
3. 环境变量改为：`IRYS_NETWORK=mainnet`、`IRYS_RPC_URL=<以太坊主网RPC>`
4. 重新部署。App-Name 标签自动去掉 `-dev` 后缀，devnet 测试数据不会混入

> ⚠️ Devnet 数据约 60 天后被清除，仅用于演示验收；Mainnet 数据一经写入永久存在且**无法删除**。

## 运维

- `/admin`（noindex）：填 `ADMIN_TOKEN` 进入——钱包余额、举报队列、一键隐藏/恢复
- 隐藏操作发布签名 moderation 记录：站内立即生效，链上数据不受影响
- 代付防滥用：类型/大小/数量硬限制（`src/lib/moderation/limits.ts`）+ 按 IP 限流；生产多实例建议将限流后端换成共享 KV

## 已知边界（MVP）

- 单文件 ≤ 3.5MB（Vercel 请求体限制）；大视频的升级路径是 Irys 余额授权 + 浏览器直传（SDK 已支持 `createApproval`/`paidBy`，未接入）
- 姓名搜索为已加载页内过滤（链上索引仅支持标签精确匹配）
- 限流为实例内存级；多实例下限额为「限额 × 实例数」
