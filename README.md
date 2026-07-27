# 永铭 Evermark

**每个人都值得被永远记住 / Everyone deserves to be remembered, forever.**

一个基于 [Irys](https://irys.xyz) 去中心化永久存储的公开记忆空间。为逝去的亲人、挚友、在世的家人或未来的自己，建立一座永不消失的数字纪念碑——文字、照片与声音被永久刻录在链上，任何人、任何时候都可以到访、献花、点烛与留言。邮箱或钱包皆可登录；存储由站点钱包代付，按量从账户余额扣费（含免费额度）。

A public space of memory built on Irys permanent storage — for the departed, for the living, for your future self. Words, photos and voices engraved on-chain forever, open for anyone to visit and remember. Sign in with email or wallet; the site wallet funds storage, metered against your balance with a free allowance.

> 项目调研与客观评价见 [docs/EVALUATION.md](docs/EVALUATION.md)。

## 核心特性

- **真正的永久** — 内容存储于 Irys 网络，不依赖本站存续；每页附「链上验证」链接，`/permanence` 页可在浏览器本地独立校验签名，`/api/export/[id]` 一键下载自证存档
- **无钱包所有权** — 创建时在浏览器生成 Ed25519 密钥对；空间 ID 由公钥哈希派生，无法被抢注或伪造；持钥可发布新版本
- **记忆星海首页** — 整页即人海：黄金角螺旋（r=c·√i, θ=i·137.5°）铺开每一个人，拖动漫游、滚轮/双指缩放，三档细节（星光 → 头像姓名 → 卡片），点击走进一段人生
- **生者与逝者两种形态** — 空间可为在世的人建立（「人生进行时」鼠尾草绿意象）或纪念逝者（金色烛光意象），同一数据模型
- **时光记录** — 长期创作：每次只需一段话、几张照片，由空间钥匙签名后独立上链，无需重发整个 manifest
- **守望机制** — 生者空间的临终托付：长期未登录 → 邮件提醒 → 亲友确认 → 30 天冷静期（本人登录即撤销）→ 管理端签名的链上 transition 记录将页面转为纪念模式
- **登录与按量计费** — 邮箱验证码或钱包（personal_sign）登录，且可互相绑定为同一账户的双通道（任一失访不丢账户）；$0.02/MB 按量计费 + 10MB 免费额度，发布前逐项报价，余额不足即时提醒；固定档位（$5/$20/$100/自定义）Stripe Checkout 充值
- **永恒套餐** — 珍藏 $29/2GB、传家 $99/10GB 一口价买断：套餐容量与免费额度同池、发布时优先扣减，一次安放、永久安心
- **回访闭环** — 缅怀周报（守护者每周获知空间新增的花/烛/留言/投稿）+ 在世空间的月度时光提醒，均由每日 cron 驱动、仅在有内容可说时发送
- **传统应用级体验** — 管理密钥自动加密托管到账户（AES-256-GCM at rest），换设备登录即可继续管理，主流程零密钥概念；偏好自主保管的用户仍可在高级选项中备份/导入/删除托管副本
- **缅怀互动** — 访客献花 / 点烛 / 永久留言 / 投稿记忆（所有者审核后展示），均为链上记录，无需登录
- **上传前审核** — 永久存储无法删除，因此在代付上传前拦截违规内容；站点层签名 hide/unhide 记录（本身也公开上链，可审计）
- **中英双语** — Cookie + Accept-Language 检测，纪念页 URL 全球唯一、不含语言前缀
- **链上为本** — manifest、tribute、contribution、entry、moderation、transition 皆为带标签的 Irys 记录；运营数据库（账户/余额/守望计时）只存可替换的便利状态，即使丢失，所有空间依然完整可读

## 技术栈

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind 4 · @irys/upload · @noble/ed25519 & secp256k1 · zod · Drizzle ORM + libSQL (Turso) · jose · Stripe (REST) · vitest

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

- 数据模型与信任链：`src/lib/memorial/`（schema.ts 是唯一事实来源；identity.ts 定义 ID 派生与各类记录的签名验证）
- Irys 读写：`src/lib/irys/`（server.ts 代付上传；query.ts GraphQL 索引）
- 审核与防滥用：`src/lib/moderation/`
- 运营层（可替换）：`src/lib/db/`（Drizzle schema：users/ledger/usage/watches）、`src/lib/auth/`（邮箱验证码 + 钱包签名 + JWT 会话）、`src/lib/billing/`（微美元整数账本）、`src/lib/watch/`（守望状态机，每日 `/api/watch/cron` 扫描）

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
4. 初始化运营数据库（本地默认 `file:./dev.db`，零配置）：`npm run db:push`
5. 管理功能（可选）：`ADMIN_TOKEN` 任意随机串 + `npm run generate-admin-key` 生成 `MODERATION_ADMIN_SECRET`（同一把密钥也用于守望 transition 记录）

开发模式下的便利降级：邮箱验证码直接返回给客户端（无需 Resend）；无 Stripe 配置时充值为模拟入账；`/api/watch/cron` 免密可调。生产环境必须配置 `SESSION_SECRET`。

测试与构建：

```bash
npm test        # vitest（信任链/审核单测）
npm run build
```

## 部署到 Vercel

1. 导入本仓库，Framework 选 Next.js（默认即可）
2. 配置环境变量（同 `.env.example`）：Irys 一组、`SESSION_SECRET`、`KEY_ENCRYPTION_SECRET`（密钥托管加密）、Turso 的 `DATABASE_URL`/`DATABASE_AUTH_TOKEN`（并对生产库执行一次 `npm run db:push`）、`RESEND_API_KEY`（登录码、守望与时光提醒邮件）、`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`（webhook 指向 `/api/recharge/webhook`）、`CRON_SECRET`（每日守望扫描 + 时光提醒，`vercel.json` 已声明 cron）
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

## 已知边界

- 单文件 ≤ 3.5MB（Vercel 请求体限制）；大视频的升级路径是 Irys 余额授权 + 浏览器直传（SDK 已支持 `createApproval`/`paidBy`，未接入）
- 姓名搜索为已加载页内过滤（链上索引仅支持标签精确匹配）
- 资金敏感路径（上传/发布/记录）为数据库级共享限流；轻路径仍为实例内存级
- 非 mainnet 部署全站显示演示模式横幅（devnet 数据约 60 天清除）；切换 mainnet 后自动消失
- 密钥托管采用平台信任模型（服务端可解密，等同传统应用）；端到端加密托管（口令派生）与社交恢复是后续方向，自主保管选项已可用
- 守望机制依赖运营数据库与邮件送达；transition 结果本身上链，但计时过程不上链
