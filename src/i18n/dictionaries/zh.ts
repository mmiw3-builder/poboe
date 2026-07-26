/**
 * Chinese dictionary — the source of truth for the dictionary shape.
 * en.ts must mirror this structure exactly (enforced by the Dictionary type).
 */
const zh = {
  common: {
    siteName: "永铭",
    siteNameFull: "永铭 Evermark",
    tagline: "每个人都值得被永远记住",
    loading: "加载中…",
    error: "出错了，请稍后再试",
    retry: "重试",
    cancel: "取消",
    confirm: "确认",
    save: "保存",
    back: "返回",
    next: "下一步",
    previous: "上一步",
    optional: "选填",
    required: "必填",
    copied: "已复制",
    copy: "复制",
    share: "分享",
    viewOnChain: "链上验证",
    permanentStorage: "永久存储于 Irys",
  },
  nav: {
    home: "首页",
    explore: "缅怀长廊",
    create: "建立纪念",
    mySpace: "我的空间",
    about: "关于",
  },
  footer: {
    poweredBy: "数据永久存储于去中心化网络",
    about: "关于我们",
    faq: "常见问题",
    terms: "服务条款",
    report: "举报内容",
  },
  home: {
    heroTitle: "有些人，值得被永远记住",
    heroSubtitle:
      "为逝去的亲人、挚友，或未来的自己，建立一座永不消失的数字纪念碑。文字、照片与影像将被永久刻录在去中心化网络上，任何人、任何时候都可以前来缅怀。",
    ctaCreate: "建立纪念空间",
    ctaExplore: "走进缅怀长廊",
    recentMemorials: "最近的纪念",
    howItWorksTitle: "为什么选择永铭",
    features: {
      permanent: {
        title: "真正的永久",
        body: "内容一经发布，即被刻录在去中心化存储网络中，不依赖任何一家公司的存续。即使本网站消失，纪念仍在。",
      },
      open: {
        title: "向所有人开放",
        body: "每个纪念空间都有一个公开的地址，任何人无需注册即可到访、献花、留言。",
      },
      free: {
        title: "无需门槛",
        body: "不需要加密货币钱包，不需要理解区块链。像使用普通网站一样，为重要的人留下永恒的记录。",
      },
    },
  },
  language: {
    label: "语言",
    zh: "中文",
    en: "English",
  },
};

export type Dictionary = typeof zh;

export default zh;
