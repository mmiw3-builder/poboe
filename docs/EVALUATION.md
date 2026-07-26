# 项目调研与客观评价：去中心化永久纪念空间

*调研日期：2026-07-26。本文是 build/no-build 决策依据，结论在先，论据在后。*

## 结论

**值得构建。** 现实意义真实且稀缺；商业化价值存在但天花板有限，属于「小而美的长青利基」而非爆发性赛道。技术可行性高：Irys 主网已于 2025-11-25 上线（[Chainwire](https://chainwire.org/2025/11/25/irys-arrives-the-first-programmable-datachain-purpose-built-for-ai-launches-mainnet/)、[DL News](https://www.dlnews.com/external/irys-arrives-the-first-programmable-datachain-purpose-built-for-ai-launches-mainnet/)），项目融资充足、SDK 活跃可用。

## 一、现实意义

1. **解决的是真问题。** 传统纪念内容依附于单一公司存续：Google/Apple/Dropbox 均有不活跃删除策略，Web2 纪念站（Legacy.com 等）的「永久」实质是「公司活多久算多久」。基于 Irys/Arweave 类永久存储的纪念内容，其存续不再依赖任何一家公司——这是**架构层面的差异化**，不是营销话术。本站即使消失，数据与可验证的所有权仍在链上。
2. **情感价值密度高。** 「普通人被记住」的需求古老而普遍；现实中的墓碑受地理、成本、拆迁限制，数字纪念碑天然规避这些。
3. **公开可访问 + 无钱包门槛**（服务端代付）让非加密用户也能使用，这是与现有 crypto 纪念项目（如 Arweave 上的 [Eternity](https://eternity.rest/)——加密私人保险库定位）的关键区隔：我们做的是**公开的缅怀空间**，不是私人遗产柜。

## 二、商业化价值（客观评估）

**市场背景：** 数字遗产大盘 2024 年约 $22.5B、预计 13%+ CAGR 增长（[Zion](https://www.zionmarketresearch.com/report/digital-legacy-market)、[Mordor](https://www.mordorintelligence.com/industry-reports/digital-legacy-market)）；但「在线纪念页」只是其中一个小切片。

**付费意愿已被验证：** Legacy.com 首年 $49 + 每年 $19；[ForeverMissed](https://www.forevermissed.com/ourplans) 一次性 $155「终身版」。一次性买断「真·永久」与 Irys 的一次付费永久存储模型**天然契合**——存储成本一次性锁定，无续费催缴，无「忘记续费内容消失」的道德风险。

**可行的收入模型：**
- 免费层（文字 + 少量照片，获客）+ 一次性「永久典藏」付费层（更多媒体、视频，定价 $49–$149，毛利率高：1GB 永久存储成本仅数美元且 Irys 声称比 Arweave 低 20 倍）
- B2B：殡葬服务机构白牌/API（客单稳定，是 death-tech 的主流变现路径）
- 代际场景：生前自建（数字遗嘱/时间胶囊）扩展

**诚实的弱点：**
- **低频、单次消费**：一人一生一次，复购接近零，增长依赖持续获客；
- **营销困难**：死亡话题存在文化禁忌，投放与病毒传播都难；
- **信任悖论**：卖点是「比公司长寿」，但早期用户仍需先信任一个新网站；需要用「链上可验证 + 数据开放格式 + 任何第三方网关可读」来自证；
- **巨头/竞品壁垒低**：功能本身可复制，护城河只能来自先发的内容沉淀（纪念页本身是不可迁移的社交资产）。

**结论：** 作为 VC 型高增长故事偏弱；作为低成本长青产品（存储成本一次性、无服务器状态、几乎零运维）是成立的，且「永久」叙事在中文与英文市场都有清晰的差异化定位。

## 三、主要风险与对策（已落入设计）

| 风险 | 对策（本项目已实现/规划） |
|---|---|
| 永久存储无法删除 vs GDPR 被遗忘权（EDPB 2025-04 指引，[activeMind](https://www.activemind.legal/guides/edpb-blockchain/)） | **上传前拦截**是唯一有效执法点：发布前自动审核；站点层 hide/unhide 签名记录（审核日志本身上链、公开可审计）；创建流程中显著告知「不可删除」 |
| 冒充他人建碑 / 逝者人格利益（民法典第 994 条） | 举报通道 + 站点层隐藏；ToS 要求创建者对内容与授权负责 |
| 代付模式被滥用刷存储 | 文件类型/大小/数量硬上限 + 按 IP 限流 + 敏感词/垃圾特征过滤 |
| Devnet 数据约 60 天清除 | 仅作验收演示；一个环境变量切换 mainnet |
| 中国大陆合规（ICP/区块链信息服务备案） | 首发面向全球（Vercel），若定向中国运营需另行备案评估 |

## 四、竞品扫描（要点）

- **Web2**：Legacy.com（讣告流量巨头）、ForeverMissed、GatheringUs 等——功能成熟，但永久性依赖公司存续，且多为订阅制；
- **Crypto**：Eternity（Arweave，加密私人遗产库，非公开纪念）；未发现有牵引力的「公开纪念空间 + 永久存储 + 免钱包」产品——**该组合位仍然空置**；
- **相邻**：Apple Legacy Contact / Google Inactive Manager（账号移交，非纪念呈现）；HereAfter AI 等「数字分身」（重 AI 交互，另一条路线）。

## 五、决策

按既定方案继续开发 MVP（服务端代付、Devnet 起步、双语、上传前审核），以 Vercel 一键部署为验收形态。
