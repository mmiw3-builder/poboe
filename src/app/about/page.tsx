import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.nav.about };
}

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-8">
      <h2 className="font-serif text-2xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-foreground/85">
        {children}
      </div>
    </section>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-border bg-surface px-5 py-4">
      <summary className="cursor-pointer list-none font-medium marker:hidden">
        {q}
      </summary>
      <p className="mt-3 text-sm leading-7 text-muted">{a}</p>
    </details>
  );
}

export default async function AboutPage() {
  const locale = await getLocale();
  const zh = locale === "zh";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 sm:px-6">
      <div className="halo pt-16 pb-6 text-center">
        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
          {zh ? "关于永铭" : "About Evermark"}
        </h1>
      </div>

      <Section title={zh ? "我们为什么存在" : "Why we exist"}>
        {zh ? (
          <>
            <p>
              绝大多数人离开这个世界时，没有留下可供后人凭吊的痕迹。照片散落在随时可能关停的云盘里，故事只存在于亲友逐渐模糊的记忆中。
            </p>
            <p>
              永铭为每一个普通人提供一座公开的数字纪念碑：文字、照片与影像被永久刻录在去中心化存储网络
              Irys 上。它不依赖任何一家公司的存续——即使本网站有一天消失，这些纪念仍将存在，任何人都可以通过公开网关读取。
            </p>
          </>
        ) : (
          <>
            <p>
              Most people leave this world without a trace their descendants
              can visit. Photos sit in cloud drives that may shut down; stories
              live only in fading memories.
            </p>
            <p>
              Evermark gives every ordinary person a public digital monument:
              words, photos and videos are permanently engraved on the Irys
              decentralized storage network. It does not depend on any single
              company — even if this website disappears one day, the memorials
              remain, readable by anyone through public gateways.
            </p>
          </>
        )}
      </Section>

      <Section title={zh ? "它如何运作" : "How it works"}>
        {zh ? (
          <>
            <p>
              发布内容时，本站的钱包代为支付一次性的永久存储费用——您无需加密货币钱包，也无需理解区块链。每个纪念空间由创建时生成、只保存在您浏览器中的管理密钥守护；持有密钥即可发布新版本，历史版本亦永久留存。
            </p>
            <p>
              每一页底部都有「链上验证」链接，可直接查看存储在网络上的原始数据，证明内容确实独立于本站存在。
            </p>
          </>
        ) : (
          <>
            <p>
              When you publish, this site&rsquo;s wallet pays the one-time
              permanent storage fee — you need no crypto wallet and no
              blockchain knowledge. Each memorial is guarded by a management
              key generated at creation and stored only in your browser;
              holding the key lets you publish new versions, while past
              versions remain forever.
            </p>
            <p>
              Every page carries a &ldquo;Verify on-chain&rdquo; link showing
              the raw data as stored on the network — proof that the content
              exists independently of this site.
            </p>
          </>
        )}
      </Section>

      <Section id="faq" title={zh ? "常见问题" : "FAQ"}>
        <div className="space-y-3">
          <Faq
            q={zh ? "发布后可以删除吗？" : "Can I delete after publishing?"}
            a={
              zh
                ? "不能。永久存储意味着数据一经写入便无法删除或篡改——这正是「永久」的代价与承诺。本站可以在站内隐藏违规内容，但链上数据仍然存在。请在发布前审慎确认。"
                : "No. Permanent storage means data cannot be deleted or altered once written — that is both the cost and the promise of permanence. This site can hide violating content from its own pages, but the on-chain data remains. Please review carefully before publishing."
            }
          />
          <Faq
            q={zh ? "管理密钥丢了怎么办？" : "What if I lose my key?"}
            a={
              zh
                ? "管理密钥只保存在您的浏览器中，我们没有副本，丢失后无法找回，该空间将无法再更新（已发布内容不受影响，永久可访问）。请务必下载密钥备份文件并妥善保存。"
                : "Keys live only in your browser; we keep no copy. A lost key cannot be recovered and the memorial can no longer be updated (published content is unaffected and stays accessible forever). Always download and safeguard the key backup file."
            }
          />
          <Faq
            q={zh ? "谁可以访问纪念空间？" : "Who can visit a memorial?"}
            a={
              zh
                ? "任何人。每个纪念空间都有公开链接，无需注册即可访问、献花、点烛与留言。"
                : "Anyone. Every memorial has a public link — no account is needed to visit, lay flowers, light candles or leave messages."
            }
          />
          <Faq
            q={zh ? "费用如何？" : "What does it cost?"}
            a={
              zh
                ? "当前阶段完全免费：存储费用由本站代付，并对上传大小设有合理限制。未来的高级功能（更大容量、更多媒体）可能采用一次性买断收费。"
                : "Currently free: storage fees are covered by the site, with reasonable size limits. Future premium features (larger capacity, more media) may use one-time pricing."
            }
          />
          <Faq
            q={zh ? "内容有审核吗？" : "Is content moderated?"}
            a={
              zh
                ? "有。因为内容无法删除，所有内容在上传前都会经过自动审核；上线后接受举报，核实违规将在站内隐藏（审核操作本身也以签名记录公开上链，可供审计）。"
                : "Yes. Because nothing can be deleted, all content is checked automatically before upload; published pages accept reports, and verified violations are hidden site-side (moderation actions are themselves signed, public on-chain records)."
            }
          />
        </div>
      </Section>

      <Section id="terms" title={zh ? "服务条款要点" : "Terms in brief"}>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted">
          {zh ? (
            <>
              <li>您确认对发布的内容拥有权利或已获授权，且不侵犯他人（含逝者）的合法权益。</li>
              <li>禁止冒充他人建立纪念、发布诽谤/骚扰/违法内容。违规内容将被站内隐藏。</li>
              <li>内容永久存储且不可删除，发布即表示理解并接受这一特性。</li>
              <li>本站为免费实验性服务，按「现状」提供，不对网络可用性作担保。</li>
            </>
          ) : (
            <>
              <li>
                You confirm you hold the rights or permission for what you
                publish, without infringing the rights of others (including the
                deceased).
              </li>
              <li>
                Impersonation, defamation, harassment and illegal content are
                prohibited and will be hidden site-side.
              </li>
              <li>
                Content is stored permanently and cannot be deleted; publishing
                signifies acceptance of this property.
              </li>
              <li>
                This is a free, experimental service provided as-is, with no
                guarantee of network availability.
              </li>
            </>
          )}
        </ul>
      </Section>

      <Section id="report" title={zh ? "举报与联系" : "Report & contact"}>
        <p>
          {zh
            ? "每个纪念空间底部都有「举报」入口。您也可以在缅怀长廊找到对应空间后提交举报，我们会尽快核实处理。"
            : "Every memorial page has a Report entry at the bottom. You can also locate the memorial in the gallery and submit a report — we review promptly."}
        </p>
        <p>
          <Link href="/explore" className="text-accent hover:underline">
            {zh ? "→ 前往缅怀长廊" : "→ Go to the gallery"}
          </Link>
        </p>
      </Section>
    </main>
  );
}
