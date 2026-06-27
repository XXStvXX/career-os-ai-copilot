(function () {
  const seed = window.careerOSSeed;
  const native = window.careerOSNative || null;
  const stateKey = "careerOSDemoStateV1";
  let state = defaultState();
  let appInfo = null;
  let ui = {
    selectedJobId: "",
    busy: "",
  };

  const topPages = [
    { id: "home", icon: "封", label: "封面" },
    { id: "jobs", icon: "运", label: "职位跟踪" },
    { id: "personal", icon: "I", label: "个人信息" },
  ];

  const routeAliases = {
    jd: "jobs",
    package: "jobs",
    tracker: "jobs",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function defaultState() {
    return {
      version: 2,
      createdAt: nowIso(),
      jobs: seed.jobs || [],
      learningGoals: seed.learningGoals || [],
      resumeReviewQueue: seed.resumeReviewQueue || [],
      githubProjects: seed.githubProjects || [],
      collector: seed.collector || { sources: [], elementLibrary: { positive: [], negative: [] }, labeledSamples: [] },
      documentUploads: [],
      packageFiles: {},
      requests: [],
      events: [],
    };
  }

  function mergeState(base, incoming) {
    if (!incoming) return base;
    const merged = { ...base, ...incoming };
    merged.jobs = Array.isArray(incoming.jobs) ? incoming.jobs : seed.jobs || [];
    merged.learningGoals = incoming.learningGoals || seed.learningGoals || [];
    merged.resumeReviewQueue = incoming.resumeReviewQueue || seed.resumeReviewQueue || [];
    merged.githubProjects = incoming.githubProjects || seed.githubProjects || [];
    merged.collector = mergeCollector(incoming.collector, seed.collector);
    merged.documentUploads = incoming.documentUploads || [];
    merged.packageFiles = incoming.packageFiles || {};
    merged.requests = incoming.requests || [];
    merged.events = incoming.events || [];
    return merged;
  }

  function mergeCollector(existing, seeded) {
    const base = seeded || { sources: [], elementLibrary: { positive: [], negative: [] }, labeledSamples: [] };
    if (!existing) return base;
    return {
      sources: existing.sources || base.sources || [],
      elementLibrary: {
        positive: existing.elementLibrary?.positive || base.elementLibrary?.positive || [],
        negative: existing.elementLibrary?.negative || base.elementLibrary?.negative || [],
      },
      portalPreferences: existing.portalPreferences || base.portalPreferences || {},
      preferenceProfile: existing.preferenceProfile || base.preferenceProfile || {},
      labeledSamples: existing.labeledSamples || base.labeledSamples || [],
      candidates: existing.candidates || base.candidates || [],
      learnedRules: existing.learnedRules || base.learnedRules || { accept: [], reject: [], review: [] },
      lastRunAt: existing.lastRunAt || "",
      lastRunStatus: existing.lastRunStatus || "",
    };
  }

  function mergeJobs(existingJobs, seedJobs) {
    const byId = new Map(existingJobs.map((job) => [job.id, job]));
    seedJobs.forEach((job) => {
      if (!byId.has(job.id)) byId.set(job.id, job);
    });
    return [...byId.values()];
  }

  async function loadState() {
    let loaded = null;
    if (native) {
      try {
        appInfo = await native.getInfo();
        loaded = await native.readState();
      } catch (error) {
        addLocalEvent("native_state_error", `读取 Electron 状态失败：${error.message}`);
      }
    }
    if (!loaded) {
      try {
        loaded = JSON.parse(localStorage.getItem(stateKey) || "null");
      } catch {
        loaded = null;
      }
    }
    state = mergeState(defaultState(), loaded);
    await saveState();
  }

  async function saveState(event) {
    if (event) addEvent(event.type, event.message);
    localStorage.setItem(stateKey, JSON.stringify(state));
    if (native) {
      try {
        await native.writeState(state);
      } catch (error) {
        addLocalEvent("native_write_error", `写入本地状态失败：${error.message}`);
      }
    }
  }

  function setBusy(label) {
    ui.busy = label || "";
    document.body.classList.toggle("is-busy", Boolean(ui.busy));
    let toast = document.getElementById("busy-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "busy-toast";
      toast.className = "busy-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = ui.busy;
    toast.classList.toggle("show", Boolean(ui.busy));
  }

  function addEvent(type, message) {
    state.events.unshift({ id: `EV-${Date.now()}`, type, message, createdAt: nowIso() });
    state.events = state.events.slice(0, 100);
  }

  function addLocalEvent(type, message) {
    state.events = state.events || [];
    addEvent(type, message);
    localStorage.setItem(stateKey, JSON.stringify(state));
  }

  function route() {
    const raw = location.hash.replace(/^#/, "") || "home";
    const [page, sub, id] = raw.split("/");
    const resolvedPage = routeAliases[page] || page;
    const top = topPages.some((item) => item.id === resolvedPage) ? resolvedPage : "home";
    return { top, sub: sub || "", id: id || "" };
  }

  function routeHref(page, sub = "", id = "") {
    return `#${[page, sub, id].filter(Boolean).join("/")}`;
  }

  function currentSub(defaultSub) {
    return route().sub || defaultSub;
  }

  function sortByDueDate(jobs) {
    return [...jobs].sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      const ap = jobPriorityScore(a);
      const bp = jobPriorityScore(b);
      if (ap !== bp) return bp - ap;
      return new Date(a.pooledAt || a.createdAt || 0).getTime() - new Date(b.pooledAt || b.createdAt || 0).getTime();
    });
  }

  function jobPriorityScore(job) {
    const text = lowerText(`${job.source || ""} ${job.company || ""} ${job.role || ""} ${job.rawText || ""}`);
    let score = Number(job.fitScore || job.score || 0);
    if (isSchoolPortalSource(job)) score += 35;
    if (hasSmallCreativeSignal(text)) score += 55;
    if (hasJuniorFriendlySignal(text)) score += 45;
    if (hasLargeCompanySignal(text) && !hasJuniorFriendlySignal(text) && !hasSmallCreativeSignal(text)) score -= 16;
    return score;
  }

  function isSchoolPortalSource(item) {
    return /school co-op portal|school job board|school portal|official co-op portal|job board/i.test(`${item.source || ""} ${item.sourceId || ""}`);
  }

  function hasSmallCreativeSignal(text) {
    return /startup|start-up|small team|small company|early stage|founder|creative team|innovation studio|boutique|incubator|venture|product-led|build from scratch|high ownership/i.test(text);
  }

  function hasJuniorFriendlySignal(text) {
    return /junior|entry level|entry-level|new grad|no prior experience|willing to train|training provided|mentor|mentorship|learn by doing|learning environment|growth path|beginner/i.test(text);
  }

  function hasLargeCompanySignal(text) {
    return /rbc|cibc|bmo|td bank|deloitte|ibm|pepsico|honda|nokia|westjet|canadian tire|hitachi/i.test(text);
  }

  function ageSince(iso) {
    if (!iso) return "未记录";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 0) return "刚刚";
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours} 小时`;
    const days = Math.floor(hours / 24);
    return `${days} 天`;
  }

  function formatDate(iso) {
    if (!iso) return "未填写";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function trackedJobs() {
    return sortByDueDate(state.jobs);
  }

  function isApproved(job) {
    return job.status === "approved";
  }

  function isProcessing(job) {
    return job.applicationStatus === "processing" || job.stage === "Processing";
  }

  function isSubmitted(job) {
    return job.applicationStatus === "submitted";
  }

  function currentJobStage(job) {
    if (isSubmitted(job)) return { label: "已投递", tone: "green", since: job.submittedAt };
    if (isProcessing(job)) return { label: "Processing", tone: "blue", since: job.processingAt || job.workEnteredAt };
    if (isApproved(job)) return { label: "已审批 / 未投递", tone: "yellow", since: job.workEnteredAt || job.approvedAt };
    return { label: "未审批", tone: "red", since: job.pooledAt };
  }

  function trackingCounts() {
    return state.jobs.reduce(
      (acc, job) => {
        acc.total += 1;
        if (!isApproved(job)) acc.unapproved += 1;
        else if (isSubmitted(job)) acc.submitted += 1;
        else if (isProcessing(job)) acc.processing += 1;
        else acc.ready += 1;
        return acc;
      },
      { total: 0, unapproved: 0, ready: 0, processing: 0, submitted: 0 },
    );
  }

  function stagePill(job) {
    const stage = currentJobStage(job);
    return `<span class="pill ${escapeHtml(stage.tone)}">${escapeHtml(stage.label)}</span>`;
  }

  function trackingTimeline(job) {
    const submitted = isSubmitted(job);
    const processing = isProcessing(job);
    const approved = isApproved(job) || processing || submitted;
    const steps = [
      {
        label: "是否已审批",
        value: approved ? "已审批" : "未审批",
        state: approved ? "done" : "active",
      },
      {
        label: "是否已投递",
        value: submitted ? "已投递" : "未投递",
        state: submitted || processing ? "done" : approved ? "active" : "pending",
      },
      {
        label: "If processing",
        value: "Processing",
        state: submitted ? "done" : processing ? "active" : "pending",
      },
      {
        label: "是否已投递",
        value: "已投递",
        state: submitted ? "active done" : "pending",
      },
    ];
    return `<div class="tracking-timeline">${steps
      .map(
        (step) => `
          <div class="tracking-step ${escapeHtml(step.state)}">
            <span>${escapeHtml(step.label)}</span>
            <strong>${escapeHtml(step.value)}</strong>
          </div>`,
      )
      .join("")}</div>`;
  }

  const collectorAnalysisProfile = {
    dataAnalystRoles: [
      "data analyst",
      "business analyst",
      "financial systems analyst",
      "intern analyst",
      "data & technology",
      "analytics associate",
      "operations analyst",
      "reporting analyst",
    ],
    aiRoles: ["ai", "machine learning", "ml", "computer vision", "generative ai", "automation"],
    smallCreativeSignals: [
      "startup",
      "start-up",
      "small team",
      "early stage",
      "innovation studio",
      "creative team",
      "product-led",
      "founder",
      "high ownership",
    ],
    juniorFriendlySignals: [
      "junior",
      "entry level",
      "entry-level",
      "new grad",
      "training provided",
      "mentor",
      "mentorship",
      "learn by doing",
      "learning environment",
      "growth path",
      "beginner",
    ],
    csHeavyTitles: [
      "full-stack",
      "full stack",
      "software engineer",
      "software developer",
      "intern developer",
      "application development",
      "backend",
      "frontend",
    ],
    csHeavyRequirements: [
      "linux",
      "unix",
      "full-stack",
      "full stack",
      "backend",
      "frontend",
      "distributed system",
      "microservice",
      "kubernetes",
      "docker",
      "ci/cd",
      "system design",
      "operating system",
      "complex system",
    ],
    dataWorkSignals: [
      "data cleaning",
      "data cleansing",
      "data analysis",
      "reporting",
      "dashboard",
      "business intelligence",
      "power bi",
      "sql",
      "excel",
      "etl",
      "analytics",
      "process improvement",
    ],
    tools: ["SQL", "Power BI", "Power Query", "DAX", "Excel", "Python", "Tableau", "ETL", "Pandas", "VBA"],
  };

  function normalizeText(value) {
    return String(value || "")
      .replace(/\r/g, "\n")
      .replace(/[•●◦]/g, "-")
      .replace(/\t/g, " ")
      .replace(/[ ]{2,}/g, " ")
      .trim();
  }

  function textLines(value) {
    return normalizeText(value)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function lowerText(value) {
    return normalizeText(value).toLowerCase();
  }

  function includesAny(text, phrases) {
    const lower = lowerText(text);
    return phrases.some((phrase) => lower.includes(String(phrase).toLowerCase()));
  }

  function matchedPhrases(text, phrases) {
    const lower = lowerText(text);
    return unique(phrases.filter((phrase) => lower.includes(String(phrase).toLowerCase())));
  }

  function programClusterSignal(text) {
    const lower = lowerText(text);
    const hasComputing = lower.includes("computing, information technology");
    const hasMathStats = lower.includes("math, statistics, economics");
    if (hasComputing && hasMathStats) return "dual";
    if (hasMathStats) return "math";
    if (hasComputing) return "computing_only";
    return "";
  }

  function dueDateUrgency(value) {
    const due = Date.parse(value || "");
    if (Number.isNaN(due)) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due - today.getTime()) / 86400000);
    if (diffDays < 0) return "past";
    if (diffDays <= 1) return "today";
    if (diffDays <= 3) return "soon";
    return "";
  }

  function firstRegex(text, regex) {
    const match = String(text || "").match(regex);
    return match ? match[1].trim() : "";
  }

  function parseCollectorMeta(rawText, overrides) {
    const text = normalizeText(rawText);
    const lines = textLines(text);
    const firstLines = lines.slice(0, 8);
    const company =
      overrides.company ||
      firstRegex(text, /(?:company|employer|organization)[:\s-]+([^\n]+)/i) ||
      firstLines.find((line) => /inc\.|ltd\.|bank|city|university|insurance|health|corp|group/i.test(line)) ||
      "Unknown Company";
    const role =
      overrides.role ||
      firstRegex(text, /(?:title|role|position|job title)[:\s-]+([^\n]+)/i) ||
      firstLines.find((line) => /analyst|associate|co-?op|intern|coordinator|assistant|developer|consultant/i.test(line)) ||
      "Untitled Role";
    const dueDate =
      overrides.dueDate ||
      firstRegex(text, /(?:deadline|closing date|apply by|due date)[:\s-]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{1,2})/i);
    const duration =
      firstRegex(text, /(?:duration|length)[:\s-]+([^\n]+)/i) ||
      firstRegex(text, /(\d+\s*(?:month|months|week|weeks))/i) ||
      "Needs review";
    const location =
      firstRegex(text, /(?:location|work location)[:\s-]+([^\n]+)/i) ||
      firstRegex(text, /(Toronto|Scarborough|Mississauga|Markham|Remote|Hybrid|Ontario)/i);
    return {
      company: company.replace(/^[-*]\s*/, "").trim(),
      role: role.replace(/^[-*]\s*/, "").trim(),
      dueDate,
      duration,
      location,
      term: overrides.term || detectTerm(text),
    };
  }

  function detectTerm(text) {
    const lower = String(text || "").toLowerCase();
    if (/2027\s*winter|winter\s*2027|27\s*winter/.test(lower)) return "27 Winter";
    if (/2027\s*summer|summer\s*2027|27\s*summer/.test(lower)) return "27 Summer";
    if (/2026\s*fall|fall\s*2026|26\s*fall/.test(lower)) return "26 Fall";
    return "26 Fall";
  }

  function scoreCollectorCandidate(rawText, meta = {}) {
    const text = normalizeText(rawText);
    const roleText = `${meta.role || ""} ${firstRegex(text, /Home\/Jobs\/[^\n]+\n([^\n]+)/i)}`;
    const fullText = `${meta.company || ""} ${roleText} ${meta.location || ""} ${text}`;
    const roleLower = lowerText(roleText);
    let score = 50;
    const strengths = [];
    const risks = [];
    const tools = matchedPhrases(fullText, collectorAnalysisProfile.tools);
    const isDataAnalystRole = includesAny(roleText, collectorAnalysisProfile.dataAnalystRoles);
    const isAiRole = includesAny(fullText, collectorAnalysisProfile.aiRoles);
    const isSchoolPortal = isSchoolPortalSource(meta);
    const isSmallCreative = includesAny(fullText, collectorAnalysisProfile.smallCreativeSignals);
    const isJuniorFriendly = includesAny(fullText, collectorAnalysisProfile.juniorFriendlySignals);
    const isLargeCompany = hasLargeCompanySignal(fullText);
    const hasDataWork = includesAny(fullText, collectorAnalysisProfile.dataWorkSignals);
    const isCsHeavyTitle = includesAny(roleText, collectorAnalysisProfile.csHeavyTitles) && !isDataAnalystRole && !roleLower.includes("data") && !roleLower.includes("ai");
    const hasCsHeavyRequirement = includesAny(fullText, collectorAnalysisProfile.csHeavyRequirements);
    const cluster = programClusterSignal(text);
    const lower = lowerText(fullText);

    if (isDataAnalystRole) {
      score += 26;
      strengths.push("数据/技术分析岗位，贴近当前主线");
    } else if (isAiRole && !isCsHeavyTitle) {
      score += 18;
      strengths.push("AI 方向可作为积极尝试");
    } else if (isCsHeavyTitle) {
      score -= 18;
      risks.push("偏纯 CS/开发岗，需要看到数据清洗、分析或 AI 应用证据才考虑");
    }

    if (hasDataWork) {
      score += 10;
      strengths.push("包含数据整理、分析、报表或流程改进工作");
    }
    if (isAiRole) {
      score += 8;
      strengths.push("可以用 GPT/Gemini/GitHub 项目讲 AI 应用能力");
    }
    if (tools.length) {
      score += Math.min(10, tools.length * 3);
      strengths.push(`出现可转化工具证据：${tools.slice(0, 4).join(", ")}`);
    }
    if (/co-?op|intern|student/i.test(fullText)) {
      score += 5;
      strengths.push("学生/Co-op 层级，适合第一段实习尝试");
    }
    if (isSchoolPortal) {
      score += 22;
      strengths.push("School portal source gets highest review priority");
    }
    if (/school-affiliated|official co-op|student portal/i.test(fullText)) {
      score += 7;
      strengths.push("School-affiliated role, priority raised");
    }
    if (isSmallCreative) {
      score += 24;
      strengths.push("小团队/创新环境信号，比大厂光环更值得优先审批");
    }
    if (isJuniorFriendly) {
      score += 22;
      strengths.push("岗位看起来愿意接纳或培养初级者");
    }
    if (isLargeCompany && !isJuniorFriendly && !isSmallCreative) {
      score -= isSchoolPortal ? 10 : 18;
      risks.push("大厂来源不再天然优先，需要 JD 明显适合第一段实习");
    }

    if (cluster === "dual") {
      score += 8;
      strengths.push("Program Cluster 同时覆盖 Computing 与 Math/Stats/Econ");
    } else if (cluster === "math") {
      score += 6;
      strengths.push("Program Cluster 覆盖 Math/Stats/Econ");
    } else if (cluster === "computing_only") {
      score -= 15;
      risks.push("Program Cluster 只偏 Computing，可能更像 CS 学生岗位");
    }

    if (hasCsHeavyRequirement) {
      score -= 18;
      risks.push("出现 Linux/复杂系统/工程化要求，CS-heavy 风险高");
    }
    if (/full[-\s]?stack/i.test(roleText)) {
      score -= 18;
      risks.push("Full-stack 基本不符合当前定位");
    }
    if (/software engineer|software developer|intern developer/i.test(roleText) && !hasDataWork && !isAiRole) {
      score -= 12;
      risks.push("泛软件开发 title，缺少数据/AI 证据");
    }
    if (/sales|commission|cold call|marketing|influencer/i.test(fullText)) {
      score -= 20;
      risks.push("可能偏销售/营销，不是当前求职主线");
    }

    if (/remote|hybrid/i.test(fullText)) {
      score += 4;
      strengths.push("Remote/Hybrid 形式友好");
    } else if (/on-site|onsite/i.test(fullText)) {
      strengths.push("On-site 不是自动拒绝项，按岗位质量判断");
    }
    if (/toronto|scarborough|markham|mississauga|maple/i.test(fullText)) {
      strengths.push("GTA 地点默认可接受，不作为主要扣分");
    }
    if (/ottawa|vancouver|new york|beijing|hong kong/i.test(fullText) && !/remote/i.test(fullText)) {
      score -= 10;
      risks.push("地点需要单独确认是否可执行");
    }
    if (/\b(12|16)\s*-\s*16\s*month|\b(12|16)\s*month/i.test(fullText)) {
      strengths.push("长 duration 对第一段实习不是自动风险");
    }

    const urgency = dueDateUrgency(meta.dueDate);
    if (urgency === "past") {
      score -= 12;
      risks.push("截止日期已过或需要确认");
    } else if (urgency === "today") {
      score -= 6;
      risks.push("截止很近，是执行风险，不是岗位匹配风险");
    } else if (urgency === "soon") {
      score -= 3;
      risks.push("截止较近，需要快速决策");
    }

    const finalScore = Math.max(20, Math.min(100, Math.round(score)));
    return {
      score: finalScore,
      strengths: unique(strengths).slice(0, 8),
      risks: unique(risks).slice(0, 8),
      tools,
      positiveHits: [],
      negativeHits: [],
      learnedHits: { accept: [], reject: [], review: [] },
      reason: unique(strengths).length
        ? `匹配：${unique(strengths).slice(0, 4).join("；")}${unique(risks).length ? `；风险：${unique(risks).slice(0, 3).join("；")}` : ""}`
        : `需要人工读 JD${unique(risks).length ? `；风险：${unique(risks).slice(0, 3).join("；")}` : ""}`,
    };
  }

  function buildCollectorCandidate(rawText, overrides) {
    const meta = parseCollectorMeta(rawText, overrides);
    const source = state.collector.sources.find((item) => item.id === overrides.sourceId);
    const score = scoreCollectorCandidate(rawText, {
      ...meta,
      sourceId: overrides.sourceId,
      source: source ? source.name : overrides.sourceId,
    });
    return {
      id: `CAND-${Date.now()}`,
      createdAt: nowIso(),
      status: "candidate",
      sourceId: overrides.sourceId,
      source: source ? source.name : overrides.sourceId,
      sourceUrl: overrides.sourceUrl,
      rawText: normalizeText(rawText),
      ...meta,
      ...score,
    };
  }

  function extractTrainingElements(label, candidate, reason) {
    const text = lowerText(`${candidate.role} ${candidate.company} ${candidate.rawText || ""} ${reason || ""}`);
    const reasonText = lowerText(reason || "");
    const signals = [];
    const isAccept = label === "accept";
    const isReject = label === "reject";

    if (isAccept && includesAny(text, collectorAnalysisProfile.dataAnalystRoles)) {
      signals.push("数据/技术分析岗位是核心目标");
    }
    if (isAccept && /school-affiliated|official co-op|student portal|学校|本校/.test(text)) {
      signals.push("School portal / school-affiliated roles are high priority");
    }
    if (isAccept && /school job board|school portal|school-affiliated|学校|本校/.test(text)) {
      signals.push("School portal source is the highest priority");
    }
    if (isAccept && /startup|start-up|小厂|小公司|small team|creative|创新|不嫌弃新手|初级|junior|entry/.test(text)) {
      signals.push("小厂/创意团队/不嫌弃初级者优先");
    }
    if (isAccept && /ai|machine learning|gpt|gemini|github|有意思|喜欢|新手/.test(text)) {
      signals.push("AI 方向值得积极尝试，尤其能用 GPT/Gemini/GitHub 成果支撑");
    }
    if (isAccept && /地点|on-?site|onsite|commute|markham|mississauga|toronto|scarborough/.test(text)) {
      signals.push("GTA 地点或 onsite 不是自动拒绝项");
    }
    if (/duration|再长也无所谓|长也无所谓/.test(reasonText)) {
      signals.push("第一段实习可以接受更长 duration");
    }
    if (isAccept && /可以尝试|平庸|不嫌弃新手|非常倾向|申请/.test(text)) {
      signals.push("有上手空间或不嫌弃新手的岗位值得尝试");
    }

    if (isReject && /cs太heavy|cs过于heavy|纯编程|纯cs|full[-\s]?stack|全栈|复杂系统|软件工程|software engineer|software developer|intern developer/.test(text)) {
      signals.push("拒绝纯 CS-heavy / full-stack / 复杂系统开发");
    }
    if (isReject && (/only.*computing|只有一个computing|preferred program clusters/.test(reasonText) || programClusterSignal(candidate.rawText || "") === "computing_only")) {
      signals.push("只面向 Computing cluster、缺少 Math/Stats/Econ 时要警惕");
    }
    if (isReject && /linux|unix|复杂系统|system/.test(text)) {
      signals.push("Linux/复杂系统要求是 CS-heavy 信号");
    }
    if (isReject && /轻微|数据整理|数据清洗|cleaning|cleansing/.test(text)) {
      signals.push("只接受轻量数据整理/清洗相关编程，不接受纯工程开发");
    }
    if (isReject && /一般般/.test(text)) {
      signals.push("泛软件开发岗位如果没有明显数据/AI 亮点，优先级低");
    }

    return unique(signals).slice(0, 10);
  }

  function updateLearnedRules(label, candidate, reason) {
    state.collector.learnedRules = state.collector.learnedRules || { accept: [], reject: [], review: [] };
    const bucket = label === "accept" ? "accept" : label === "reject" ? "reject" : "review";
    const elements = extractTrainingElements(label, candidate, reason);
    elements.forEach((element) => {
      const normalized = element.toLowerCase();
      const existing = state.collector.learnedRules[bucket].find((item) => item.normalized === normalized);
      if (existing) {
        existing.count += 1;
        existing.lastSeenAt = nowIso();
        existing.examples = unique([...(existing.examples || []), candidate.id]).slice(0, 5);
        if (reason && !(existing.reasons || []).includes(reason)) {
          existing.reasons = [reason, ...(existing.reasons || [])].slice(0, 3);
        }
        return;
      }
      state.collector.learnedRules[bucket].unshift({
        id: `RULE-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        label: element,
        normalized,
        count: 1,
        firstSeenAt: nowIso(),
        lastSeenAt: nowIso(),
        examples: [candidate.id],
        reasons: reason ? [reason] : [],
      });
    });
    state.collector.learnedRules[bucket] = state.collector.learnedRules[bucket]
      .sort((a, b) => b.count - a.count || new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
      .slice(0, 60);
  }

  function addTrainingSampleFromCandidate(label, candidate, reason) {
    state.collector.labeledSamples.unshift({
      id: `SAMPLE-${Date.now()}`,
      createdAt: nowIso(),
      title: `${candidate.company} - ${candidate.role}`,
      label: label === "accept" ? "like" : label === "reject" ? "dislike" : "review",
      reason,
      candidateId: candidate.id,
      source: candidate.source,
      score: candidate.score,
      strengths: candidate.strengths || [],
      risks: candidate.risks || [],
    });
    state.collector.labeledSamples = state.collector.labeledSamples.slice(0, 150);
    updateLearnedRules(label, candidate, reason);
  }

  function nextJobId() {
    const year = new Date().getFullYear();
    const max = state.jobs.reduce((highest, job) => {
      const match = String(job.id || "").match(/JD-\d{4}-(\d+)/);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    return `JD-${year}-${String(max + 1).padStart(3, "0")}`;
  }

  function render() {
    const r = route();
    renderShell(r);
    if (r.top === "home") renderHome();
    if (r.top === "jobs") renderJobs();
    if (r.top === "personal") renderPersonal();
  }

  function renderShell(r) {
    $("app-nav").innerHTML = topPages
      .map(
        (item) =>
          `<a href="${routeHref(item.id)}" class="${r.top === item.id ? "active" : ""}">
            <span class="nav-icon">${escapeHtml(item.icon)}</span>
            <span class="nav-text">${escapeHtml(item.label)}</span>
          </a>`,
      )
      .join("");

    $("workspace-card").innerHTML = `
      <strong>${native ? "Electron 本地模式" : "浏览器降级模式"}</strong>
      <p>${native ? "文件夹创建、文件上传、状态 JSON 写入已走本地后端。" : "只能保存浏览器状态，不能稳定读写本地文件。"}</p>
      <button type="button" id="open-app-root">${native ? "打开运行文件夹" : "查看限制"}</button>
    `;
    $("open-app-root").addEventListener("click", () => {
      if (native) openPath(".");
      else alert("浏览器模式无法直接管理本地文件。请用 Electron 启动。");
    });
  }

  function setPageTitle(eyebrow, title, actions = "") {
    $("page-eyebrow").textContent = eyebrow;
    $("page-title").textContent = title;
    $("top-actions").innerHTML = `${ui.busy ? `<span class="saving-indicator">${escapeHtml(ui.busy)}</span>` : ""}${actions}`;
  }

  function renderHome() {
    const counts = trackingCounts();

    setPageTitle("Cover", "今日封面", `<button class="secondary" type="button" id="save-state">保存状态</button>`);
    $("app-content").innerHTML = `
      <section class="hero">
        <div>
          <span class="hero-kicker">Career OS</span>
          <h2>早上打开，只看要紧的。</h2>
          <p>职位现在按一条“运单式”状态链跟踪：未审批、已审批但未投递、Processing、已投递。审批、整理 package、投递记录都回到同一个职位页面。</p>
        </div>
        <div class="hero-status">
          <span>${native ? "Native file system ready" : "Browser fallback"}</span>
          <strong>${counts.submitted} submitted</strong>
        </div>
      </section>
      <section class="grid five">
        ${metric("全部职位", counts.total, "所有来源、所有状态都在同一个跟踪池里")}
        ${metric("未审批", counts.unapproved, "需要你决定是否值得继续推进")}
        ${metric("已审批未投递", counts.ready, "可以开始整理 package 或等待处理")}
        ${metric("Processing", counts.processing, "正在准备简历、求职信或下一步动作")}
        ${metric("已投递", counts.submitted, "已经完成投递并进入申请后跟踪")}
      </section>
      <section class="panel panel-soft">
        <div class="section-head">
          <div>
            <p class="eyebrow">Learning Goals</p>
            <h2>学习目标</h2>
          </div>
        </div>
        <div class="grid three">
          ${state.learningGoals
            .map(
              (goal) => `
              <div class="info-card">
                <small>${escapeHtml(goal.target)}</small>
                <h3>${escapeHtml(goal.name)}</h3>
                <p>${escapeHtml(goal.next)}</p>
                <div class="progress"><span style="width:${Number(goal.progress) || 0}%"></span></div>
              </div>`,
            )
            .join("")}
        </div>
      </section>
      <section class="panel panel-soft">
        <div class="section-head">
          <div>
            <p class="eyebrow">Entrances</p>
            <h2>功能入口</h2>
          </div>
        </div>
        <div class="grid two">
          ${homeEntrance(routeHref("jobs"), "职位跟踪", "所有职位统一按运单状态推进。")}
          ${homeEntrance(routeHref("personal"), "个人信息", "文档池和 GitHub 工程进度。")}
        </div>
      </section>
      <section class="panel panel-soft event-log">
        <p class="eyebrow">Recent Events</p>
        <h2>最近记录</h2>
        ${state.events.length ? `<ul>${state.events.slice(0, 8).map((event) => `<li>${escapeHtml(event.createdAt)} - ${escapeHtml(event.message || event.type)}</li>`).join("")}</ul>` : `<p>还没有操作记录。</p>`}
      </section>
    `;
    $("save-state").addEventListener("click", async () => {
      await saveState({ type: "manual_save", message: "手动保存状态" });
      alert(native ? "已写入 runtime_state。" : "已保存到浏览器 localStorage。");
    });
  }

  function metric(label, value, note) {
    return `<div class="metric-card"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><p>${escapeHtml(note)}</p></div>`;
  }

  function homeEntrance(href, title, text) {
    return `<a class="info-card" href="${href}"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></a>`;
  }

  function renderJobs() {
    const rawView = currentSub("pool");
    const currentRoute = route();
    const view = rawView === "collector" ? "collector" : rawView === "detail" ? "detail" : "pool";
    if (view === "detail") {
      renderJobDetailPage(currentRoute.id);
      return;
    }
    setPageTitle(
      "Job Tracking",
      "职位池",
      `<button class="secondary" type="button" id="refresh-jd-pool">运行自动收集请求</button>`,
    );
    if (view === "collector") {
      renderCollector();
      return;
    }

    const jobs = trackedJobs();

    $("app-content").innerHTML = `
      ${tabs([
        ["pool", `职位池 (${jobs.length})`, routeHref("jobs", "pool")],
        ["collector", "自动收集器", routeHref("jobs", "collector")],
      ], "pool")}
      <section class="panel panel-soft">
        <div class="section-head">
          <div>
            <p class="eyebrow">Unified Pool</p>
            <h2>所有职位</h2>
            <p>第一层只保留职位池列表。点击任意职位行，进入它自己的操作页面。</p>
          </div>
        </div>
        <div class="tracking-table">
          <div class="tracking-table-head">
            <span>职位</span>
            <span>公司</span>
            <span>学期</span>
            <span>来源</span>
            <span>Due</span>
            <span>状态</span>
            <span>时长</span>
            <span>原 JD</span>
          </div>
          ${jobs.length ? jobs.map(renderTrackingRow).join("") : `<div class="empty">还没有职位。</div>`}
        </div>
      </section>
    `;

    $("refresh-jd-pool").addEventListener("click", requestJdRefresh);
    attachOpenUrlButtons();
  }

  function renderTrackingRow(job) {
    const stage = currentJobStage(job);
    const priorityLabel = priorityBadge(job);
    return `
      <a class="tracking-row" href="${routeHref("jobs", "detail", job.id)}">
        <span class="tracking-cell tracking-title">
          <span class="job-meta">${escapeHtml(job.id)}</span>
          <strong>${escapeHtml(job.role)}</strong>
          ${priorityLabel}
        </span>
        <span class="tracking-cell">${escapeHtml(job.company)}</span>
        <span class="tracking-cell">${escapeHtml(job.term)}</span>
        <span class="tracking-cell">${escapeHtml(job.source)}</span>
        <span class="tracking-cell">${escapeHtml(formatDate(job.dueDate))}</span>
        <span class="tracking-cell">${stagePill(job)}</span>
        <span class="tracking-cell muted-cell">${escapeHtml(ageSince(stage.since || job.pooledAt))}</span>
        <span class="tracking-cell tracking-link-cell">${sourceUrlButton(job.sourceUrl)}</span>
      </a>
    `;
  }

  function priorityBadge(job) {
    const text = lowerText(`${job.company || ""} ${job.role || ""} ${job.rawText || ""}`);
    if (isSchoolPortalSource(job)) return `<span class="job-priority-badge">School portal</span>`;
    if (hasSmallCreativeSignal(text) || hasJuniorFriendlySignal(text)) return `<span class="job-priority-badge">小厂/初级友好</span>`;
    return "";
  }

  function sourceUrlButton(url, label = "打开原 JD") {
    return url
      ? `<button class="secondary mini-link-button" type="button" data-open-url="${escapeHtml(url)}">${escapeHtml(label)}</button>`
      : `<span class="missing-link">无原 JD 链接</span>`;
  }

  function renderJobDetailPage(jobId) {
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job) {
      setPageTitle("Job Detail", "职位操作页面", `<a class="button-link secondary" href="${routeHref("jobs", "pool")}">返回职位池</a>`);
      $("app-content").innerHTML = `<section class="panel panel-soft"><div class="empty">没有找到这个职位。返回职位池重新选择。</div></section>`;
      return;
    }
    ui.selectedJobId = job.id;
    setPageTitle("Job Detail", "职位操作页面", `<a class="button-link secondary" href="${routeHref("jobs", "pool")}">返回职位池</a>`);
    $("app-content").innerHTML = `
      <section class="detail-shell">
        <div class="detail-breadcrumb">
          <a href="${routeHref("jobs", "pool")}">职位池</a>
          <span>/</span>
          <strong>${escapeHtml(job.id)}</strong>
        </div>
        <section class="panel panel-soft detail-panel">
          ${renderTrackingDetail(job)}
        </section>
      </section>
    `;
    attachTrackingDetail(job);
  }

  function renderTrackingDetail(job) {
    const files = state.packageFiles[job.id] || [];
    const approved = isApproved(job);
    const processing = isProcessing(job);
    const submitted = isSubmitted(job);
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">${escapeHtml(job.id)}</p>
          <h2>${escapeHtml(job.company)} - ${escapeHtml(job.role)}</h2>
          <p>${escapeHtml(job.term)} · ${escapeHtml(job.duration || "未填写")} · ${escapeHtml(job.source)} · Due ${escapeHtml(formatDate(job.dueDate))}</p>
        </div>
        ${stagePill(job)}
      </div>
      <div class="tracking-detail-timeline">
        ${trackingTimeline(job)}
      </div>
      <div class="button-row">
        <button class="secondary" type="button" data-open-url="${escapeHtml(job.sourceUrl || "")}">打开原 JD</button>
        ${approved ? `<button class="secondary" type="button" id="ensure-job-folder">生成/确认本地文件夹</button>` : ""}
        ${approved ? `<button class="secondary" type="button" id="open-job-folder">打开对应标签文件夹</button>` : ""}
      </div>
      <div class="button-row action-row">
        ${!approved ? `<button class="primary" type="button" id="tracking-approve">审批通过</button>` : ""}
        ${approved && !processing && !submitted ? `<button class="primary" type="button" id="tracking-processing">开始 Processing</button>` : ""}
        ${processing && !submitted ? `<button class="secondary" type="button" id="tracking-unsubmitted">退回未投递</button>` : ""}
        ${approved && !submitted ? `<button class="success" type="button" id="mark-submitted">标记已投递</button>` : ""}
        ${submitted ? `<button class="danger" type="button" id="tracking-unsubmitted">改回未投递</button>` : ""}
      </div>
      ${
        approved
          ? `
            <div class="grid two">
              ${dropboxHtml("resume-drop", "简历 Dropbox", "上传这个岗位对应的 resume 文件。")}
              ${dropboxHtml("letter-drop", "求职信 Dropbox", "上传这个岗位对应的 cover letter 文件。")}
            </div>
            <div class="info-card file-list-card">
              <h3>已记录文件</h3>
              ${files.length ? `<ul>${files.map((file) => `<li>${escapeHtml(file.kind)} · ${escapeHtml(file.name)} · ${escapeHtml(file.savedAt)}${file.savedToDisk ? " · 已落盘" : " · 未落盘"}</li>`).join("")}</ul>` : `<p>还没有文件。</p>`}
            </div>
          `
          : `<div class="info-card"><h3>先审批，再整理 Package</h3><p>这个职位仍处于未审批状态。审批通过后，这里会出现本地文件夹、简历 Dropbox、求职信 Dropbox 和投递按钮。</p></div>`
      }
      ${
        submitted
          ? `
            <div class="info-card">
              <h3>申请后链接</h3>
              <div class="link-editor">
                <input id="apply-link" placeholder="粘贴申请后的链接" value="${escapeHtml(job.postApplyUrl || "")}" />
                <button type="button" class="primary" id="save-apply-link">完成修改</button>
              </div>
              <p>${job.postApplyUrl ? `<button class="secondary" type="button" data-open-url="${escapeHtml(job.postApplyUrl)}">打开已保存链接</button>` : "还没有保存申请后链接。"}</p>
            </div>
          `
          : ""
      }
    `;
  }

  function attachTrackingDetail(job) {
    const approve = $("tracking-approve");
    const processing = $("tracking-processing");
    const unsubmitted = $("tracking-unsubmitted");
    const submitted = $("mark-submitted");
    const ensureFolder = $("ensure-job-folder");
    const openFolder = $("open-job-folder");
    const saveLink = $("save-apply-link");

    if (approve) approve.addEventListener("click", () => approveJob(job.id));
    if (processing) processing.addEventListener("click", () => startProcessing(job.id));
    if (unsubmitted) unsubmitted.addEventListener("click", () => markUnsubmitted(job.id));
    if (submitted) submitted.addEventListener("click", () => markSubmitted(job.id));
    if (ensureFolder) ensureFolder.addEventListener("click", () => ensureJobFolder(job, true));
    if (openFolder) openFolder.addEventListener("click", () => openJobFolder(job));
    if (isApproved(job)) {
      setupDropzone("resume-drop", (files) => savePackageFiles(job, "resume", files));
      setupDropzone("letter-drop", (files) => savePackageFiles(job, "cover_letter", files));
    }
    if (saveLink) {
      saveLink.addEventListener("click", async () => {
        job.postApplyUrl = $("apply-link").value.trim();
        await saveState({ type: "update_application_link", message: `更新申请后链接 ${job.id}` });
        renderJobs();
      });
    }
    attachOpenUrlButtons();
  }

  function renderCollector() {
    const collector = state.collector;
    const candidates = collector.candidates || [];
    const activeCandidates = candidates.filter((candidate) => candidate.status === "candidate");
    $("app-content").innerHTML = `
      ${tabs([
        ["pool", `职位池 (${trackedJobs().length})`, routeHref("jobs", "pool")],
        ["collector", "自动收集器", routeHref("jobs", "collector")],
      ], "collector")}
      <section class="panel panel-soft">
        <div class="section-head">
          <div>
            <p class="eyebrow">Collector</p>
            <h2>自动收集器</h2>
            <p>这里现在只做一件事：接收自动收集来的候选职位，然后让你用“接受/拒绝 + 一句话原因”训练筛选器。</p>
          </div>
          <button class="primary" type="button" id="collector-run">提交收集请求</button>
        </div>
        <div class="collector-summary">
          <div class="summary-chip"><strong>${activeCandidates.length}</strong><span>待审批候选</span></div>
          <div class="summary-chip"><strong>${collector.labeledSamples.length}</strong><span>训练样本</span></div>
          <div class="summary-chip"><strong>${learnedRuleCount()}</strong><span>已学元素</span></div>
        </div>
      </section>
      <section class="panel panel-soft">
        <div class="section-head">
          <div>
            <p class="eyebrow">Candidate Inbox</p>
            <h2>训练审批候选</h2>
            <p>对每个候选写一句原因，然后接受或拒绝。接受会进入职位池；拒绝会从候选区移除并训练筛选规则。</p>
          </div>
        </div>
        <div class="candidate-list">
          ${activeCandidates.length ? activeCandidates.map(renderCollectorCandidate).join("") : `<div class="empty">还没有待批准候选。点击“提交收集请求”，我后续会把自动筛出的职位倒进这里。</div>`}
        </div>
      </section>
      <section class="panel panel-soft">
        <div class="section-head">
          <div>
            <p class="eyebrow">Learned Rules</p>
            <h2>自动沉淀的筛选元素</h2>
            <p>这里不是你手动维护的规则表，而是平台根据你对候选的接受/拒绝原因自动整理的偏好记忆。</p>
          </div>
        </div>
        ${renderLearnedRules()}
      </section>
    `;
    $("refresh-jd-pool").addEventListener("click", requestJdRefresh);
    $("collector-run").addEventListener("click", requestJdRefresh);
    document.querySelectorAll("[data-approve-candidate]").forEach((button) => {
      button.addEventListener("click", () => approveCollectorCandidate(button.getAttribute("data-approve-candidate")));
    });
    document.querySelectorAll("[data-reject-candidate]").forEach((button) => {
      button.addEventListener("click", () => rejectCollectorCandidate(button.getAttribute("data-reject-candidate")));
    });
    document.querySelectorAll("[data-review-candidate]").forEach((button) => {
      button.addEventListener("click", () => reviewCollectorCandidate(button.getAttribute("data-review-candidate")));
    });
    attachOpenUrlButtons();
  }

  function learnedRuleCount() {
    const rules = state.collector.learnedRules || { accept: [], reject: [], review: [] };
    return (rules.accept || []).length + (rules.reject || []).length + (rules.review || []).length;
  }

  function renderCollectorCandidate(candidate) {
    return `
      <article class="candidate-card">
        <div>
          <p class="eyebrow">${escapeHtml(candidate.id)} · ${escapeHtml(candidate.source)}</p>
          <h3>${escapeHtml(candidate.company)} - ${escapeHtml(candidate.role)}</h3>
          <p>${escapeHtml(candidate.term)} · Due ${escapeHtml(candidate.dueDate || "未填写")} · ${escapeHtml(candidate.location || "地点未识别")}</p>
          <p>${escapeHtml(candidate.reason)}</p>
          <div class="candidate-tags">
            ${(candidate.strengths || []).slice(0, 8).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
          ${(candidate.risks || []).length ? `<p class="risk-line">风险：${escapeHtml(candidate.risks.slice(0, 5).join(", "))}</p>` : ""}
        </div>
        <div class="candidate-score">
          <strong>${Math.round(candidate.score)}</strong>
          <span>match</span>
          ${sourceUrlButton(candidate.sourceUrl)}
        </div>
        <div class="candidate-training">
          <textarea id="reason-${escapeHtml(candidate.id)}" rows="2" placeholder="为什么接受/拒绝？例如：SQL+Power BI 很匹配；地点太远；销售成分太重。"></textarea>
          <div class="button-row">
            <button class="primary" type="button" data-approve-candidate="${escapeHtml(candidate.id)}">接受并入池</button>
            <button class="danger" type="button" data-reject-candidate="${escapeHtml(candidate.id)}">拒绝并训练</button>
            <button class="secondary" type="button" data-review-candidate="${escapeHtml(candidate.id)}">稍后再看</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderLearnedRules() {
    const rules = state.collector.learnedRules || { accept: [], reject: [], review: [] };
    return `
      <div class="grid three">
        ${renderRuleBucket("accept", "接受元素", rules.accept || [])}
        ${renderRuleBucket("reject", "拒绝元素", rules.reject || [])}
        ${renderRuleBucket("review", "灰区复查", rules.review || [])}
      </div>
    `;
  }

  function renderRuleBucket(kind, title, rules) {
    return `
      <div class="info-card learned-rule-card">
        <h3>${escapeHtml(title)}</h3>
        ${rules.length ? `<div class="learned-rule-list">${rules.slice(0, 12).map((rule) => `
          <div class="learned-rule ${escapeHtml(kind)}">
            <span>${escapeHtml(rule.label)}</span>
            <b>${escapeHtml(rule.count)}</b>
          </div>`).join("")}</div>` : `<p>还没有样本。</p>`}
      </div>
    `;
  }

  async function approveCollectorCandidate(candidateId) {
    const candidate = (state.collector.candidates || []).find((item) => item.id === candidateId);
    if (!candidate) return;
    const reason = ($(`reason-${candidateId}`)?.value || "").trim();
    if (!reason) {
      alert("请先写一句接受原因，这会用于训练 collector。");
      return;
    }
    addTrainingSampleFromCandidate("accept", candidate, reason);
    const duplicate = state.jobs.find((job) => {
      const sameUrl = candidate.sourceUrl && job.sourceUrl === candidate.sourceUrl;
      const sameRole = job.company === candidate.company && job.role === candidate.role;
      return sameUrl || sameRole;
    });
    if (duplicate) {
      candidate.status = "approved_to_pool";
      candidate.approvedJobId = duplicate.id;
      candidate.trainingLabel = "accept";
      candidate.trainingReason = reason;
      await saveState({ type: "collector_candidate_duplicate", message: `候选已存在职位池：${duplicate.id}` });
      renderCollector();
      return;
    }
    const job = {
      id: nextJobId(),
      company: candidate.company,
      role: candidate.role,
      term: candidate.term || "26 Fall",
      duration: candidate.duration || "Needs review",
      dueDate: candidate.dueDate || "",
      source: candidate.source || "Collector",
      status: "unapproved",
      pooledAt: nowIso(),
      applicationStatus: "not_submitted",
      stage: "Collected",
      sourceUrl: candidate.sourceUrl || "",
      location: candidate.location || "",
      fitScore: candidate.score,
      collectorCandidateId: candidate.id,
      collectorReason: candidate.reason,
      collectorStrengths: candidate.strengths || [],
      collectorRisks: candidate.risks || [],
      rawText: candidate.rawText,
    };
    state.jobs.unshift(job);
    candidate.status = "approved_to_pool";
    candidate.approvedJobId = job.id;
    candidate.trainingLabel = "accept";
    candidate.trainingReason = reason;
    await saveState({ type: "collector_candidate_approved", message: `候选入池 ${job.id} ${job.company} - ${job.role}` });
    location.hash = routeHref("jobs", "pool");
    render();
  }

  async function rejectCollectorCandidate(candidateId) {
    const candidate = (state.collector.candidates || []).find((item) => item.id === candidateId);
    if (!candidate) return;
    const reason = ($(`reason-${candidateId}`)?.value || "").trim();
    if (!reason) {
      alert("请先写一句拒绝原因，这会用于训练 collector。");
      return;
    }
    addTrainingSampleFromCandidate("reject", candidate, reason);
    candidate.status = "rejected";
    candidate.rejectedAt = nowIso();
    candidate.trainingLabel = "reject";
    candidate.trainingReason = reason;
    await saveState({ type: "collector_candidate_rejected", message: `拒绝候选并训练：${candidate.company} - ${candidate.role}` });
    renderCollector();
  }

  async function reviewCollectorCandidate(candidateId) {
    const candidate = (state.collector.candidates || []).find((item) => item.id === candidateId);
    if (!candidate) return;
    const reason = ($(`reason-${candidateId}`)?.value || "").trim() || "需要稍后复查";
    addTrainingSampleFromCandidate("review", candidate, reason);
    candidate.reviewReason = reason;
    candidate.reviewedAt = nowIso();
    await saveState({ type: "collector_candidate_review_later", message: `候选保留稍后复查：${candidate.company} - ${candidate.role}` });
    renderCollector();
  }

  function tabs(items, active) {
    return `<div class="tabs">${items
      .map(([id, label, href]) => `<a class="tab ${id === active ? "active" : ""}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`)
      .join("")}</div>`;
  }

  async function requestJdRefresh() {
    const request = {
      id: `REQ-${Date.now()}`,
      type: "job_collector_run",
      createdAt: nowIso(),
      status: "pending_for_codex",
      sources: state.collector.sources,
      portalPreferences: state.collector.portalPreferences || {},
      elementLibrary: state.collector.elementLibrary,
      labeledSamples: state.collector.labeledSamples.slice(0, 20),
      openCandidates: (state.collector.candidates || []).filter((candidate) => candidate.status === "candidate").slice(0, 20),
      message: "用户在平台中提交自动收集请求：请基于来源、元素库和样本偏好收集新职位并倒入统一职位跟踪池。",
    };
    state.collector.lastRunAt = request.createdAt;
    state.collector.lastRunStatus = "pending_for_codex";
    state.requests.unshift(request);
    state.requests = state.requests.slice(0, 60);
    await saveState({ type: "collector_run_requested", message: "已记录自动收集请求" });
    alert(native ? "自动收集请求已写入 runtime_requests。" : "自动收集请求只保存在浏览器本地。");
    render();
  }

  async function approveJob(jobId) {
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job) return;
    job.status = "approved";
    job.approvedAt = job.approvedAt || nowIso();
    job.workEnteredAt = job.workEnteredAt || nowIso();
    job.applicationStatus = job.applicationStatus || "not_submitted";
    job.stage = "Approved - not submitted";
    await saveState({ type: "approve_jd", message: `审批通过 ${job.id} ${job.company} - ${job.role}` });
    render();
  }

  async function startProcessing(jobId) {
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job) return;
    job.status = "approved";
    job.approvedAt = job.approvedAt || nowIso();
    job.workEnteredAt = job.workEnteredAt || nowIso();
    job.applicationStatus = "processing";
    job.processingAt = job.processingAt || nowIso();
    job.stage = "Processing";
    await saveState({ type: "start_processing", message: `开始 Processing ${job.id} ${job.company} - ${job.role}` });
    render();
  }

  function dropboxHtml(id, title, text) {
    return `
      <label class="dropbox" id="${id}">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(text)}</span>
        <input type="file" multiple />
        <button type="button" class="secondary">选择文件</button>
      </label>
    `;
  }

  async function ensureJobFolder(job, noisy) {
    if (!native) {
      if (noisy) alert("浏览器模式不能创建本地文件夹。请用 Electron 启动。");
      return;
    }
    try {
      setBusy("正在确认文件夹...");
      const result = await native.ensureJobFolder(job);
      job.folderCreatedAt = job.folderCreatedAt || nowIso();
      job.folderPath = result.folderPath;
      await saveState({ type: "ensure_job_folder", message: `${result.existed ? "确认已有" : "新建"}工作台文件夹 ${job.id}` });
      if (noisy) alert(result.existed ? "文件夹已经存在，没有重复创建。" : "已创建对应标签文件夹。");
    } catch (error) {
      alert(`生成文件夹失败：${error.message}`);
    } finally {
      setBusy("");
    }
  }

  async function openJobFolder(job) {
    if (!native) {
      alert("浏览器模式不能打开本地文件夹。请用 Electron 启动。");
      return;
    }
    try {
      setBusy("正在打开文件夹...");
      const result = await native.openJobFolder(job);
      job.folderCreatedAt = job.folderCreatedAt || nowIso();
      job.folderPath = result.folderPath;
      await saveState({ type: "open_job_folder", message: `打开工作台文件夹 ${job.id}` });
    } catch (error) {
      alert(`打开文件夹失败：${error.message}`);
    } finally {
      setBusy("");
    }
  }

  async function savePackageFiles(job, kind, files) {
    if (!files.length) return;
    if (!job.folderCreatedAt) await ensureJobFolder(job, false);
    let result = { ok: false, saved: [] };
    if (native) {
      try {
        setBusy("正在保存文件...");
        result = await native.savePackageFiles(job, kind, files);
      } catch (error) {
        alert(`保存文件失败：${error.message}`);
      } finally {
        setBusy("");
      }
    }
    state.packageFiles[job.id] = state.packageFiles[job.id] || [];
    Array.from(files).forEach((file) => {
      state.packageFiles[job.id].push({
        name: file.name,
        kind,
        savedAt: nowIso(),
        savedToDisk: Boolean(result.ok),
      });
    });
    await saveState({ type: "upload_package_file", message: `上传 ${files.length} 个 ${kind} 文件到 ${job.id}` });
    render();
  }

  async function markSubmitted(jobId) {
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job) return;
    job.status = "approved";
    job.approvedAt = job.approvedAt || nowIso();
    job.workEnteredAt = job.workEnteredAt || nowIso();
    job.applicationStatus = "submitted";
    job.submittedAt = job.submittedAt || nowIso();
    job.stage = "Submitted";
    await saveState({ type: "mark_submitted", message: `已投递 ${job.id} ${job.company} - ${job.role}` });
    ui.selectedJobId = job.id;
    location.hash = routeHref("jobs", "detail", job.id);
    render();
  }

  async function markUnsubmitted(jobId) {
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job) return;
    job.applicationStatus = "not_submitted";
    job.submittedAt = "";
    job.processingAt = "";
    job.stage = job.status === "approved" ? "Approved - not submitted" : "Pending approval";
    await saveState({ type: "mark_unsubmitted", message: `标记未投递 ${job.id}` });
    ui.selectedJobId = job.id;
    render();
  }

  function renderPersonal() {
    const view = currentSub("home");
    setPageTitle("Personal", "个人信息", "");
    $("app-content").innerHTML = `
      ${tabs([
        ["home", "分流页", routeHref("personal", "home")],
        ["documents", "文档池", routeHref("personal", "documents")],
        ["github", "GitHub 工程进度", routeHref("personal", "github")],
      ], view)}
      ${view === "documents" ? renderDocumentsHtml() : view === "github" ? renderGithubHtml() : renderPersonalHomeHtml()}
    `;
    if (view === "documents") attachDocumentsHandlers();
    if (view === "github") attachOpenUrlButtons();
  }

  function renderPersonalHomeHtml() {
    return `
      <section class="hero">
        <div>
          <span class="hero-kicker">Personal Assets</span>
          <h2>个人信息分流</h2>
          <p>这里分成两个子页面：文档池用于收集所有申请 package 模板；GitHub 工程进度用于快速进入项目和查看下一步。</p>
        </div>
      </section>
      <section class="grid two">
        ${homeEntrance(routeHref("personal", "documents"), "文档池", "Resume 模板、成绩单、求职信模板和其他申请材料。")}
        ${homeEntrance(routeHref("personal", "github"), "GitHub 工程进度", "项目目标、进程和快速链接。")}
      </section>
    `;
  }

  function renderDocumentsHtml() {
    return `
      <section class="panel panel-soft">
        <p>固定文件夹：<strong>document_pool</strong>。上传文件会按文件名自动分到 resume_templates、transcripts、cover_letters 或 other_documents。</p>
        ${dropboxHtml("document-drop", "文档池 Dropbox", "把可复用的申请 package 模板拖进来。")}
        <div class="button-row">
          <button class="secondary" type="button" id="open-document-pool">打开 document_pool</button>
        </div>
      </section>
      <section class="panel panel-soft">
        <p class="eyebrow">Document Pool</p>
        <h2>已记录文档</h2>
        ${state.documentUploads.length ? `<ul>${state.documentUploads.map((file) => `<li>${escapeHtml(file.category)} · ${escapeHtml(file.name)} · ${escapeHtml(file.savedAt)}${file.savedToDisk ? " · 已落盘" : " · 未落盘"}</li>`).join("")}</ul>` : `<p>还没有上传记录。</p>`}
      </section>
      <section class="panel panel-soft">
        <p class="eyebrow">Resume Review Queue</p>
        <h2>简历/模板审核池</h2>
        <div class="job-list">
          ${state.resumeReviewQueue
            .map(
              (item) => `
              <article class="job-row">
                <div class="job-main"><span class="job-meta">${escapeHtml(item.id)}</span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.path)}</p></div>
                <div>${item.status === "approved" ? `<span class="pill green">已审核</span>` : `<span class="pill red">未审核</span>`}</div>
                <div><button class="secondary" data-approve-resume="${escapeHtml(item.id)}" type="button">标记已审核</button></div>
              </article>`,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function attachDocumentsHandlers() {
    setupDropzone("document-drop", saveDocumentFiles);
    $("open-document-pool").addEventListener("click", () => openPath("document_pool"));
    document.querySelectorAll("[data-approve-resume]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = state.resumeReviewQueue.find((resume) => resume.id === button.getAttribute("data-approve-resume"));
        if (!item) return;
        item.status = "approved";
        await saveState({ type: "approve_resume_template", message: `标记已审核 ${item.name}` });
        renderPersonal();
      });
    });
  }

  async function saveDocumentFiles(files) {
    if (!files.length) return;
    let result = { ok: false, saved: [] };
    if (native) {
      try {
        setBusy("正在保存文档...");
        result = await native.saveDocumentFiles(files);
      } catch (error) {
        alert(`保存文档失败：${error.message}`);
      } finally {
        setBusy("");
      }
    }
    Array.from(files).forEach((file) => {
      const saved = result.saved.find((item) => item.name === file.name);
      state.documentUploads.unshift({
        name: file.name,
        category: saved ? saved.category : documentCategory(file.name),
        savedAt: nowIso(),
        savedToDisk: Boolean(result.ok),
      });
    });
    await saveState({ type: "upload_document_pool", message: `文档池上传 ${files.length} 个文件` });
    renderPersonal();
  }

  function documentCategory(filename) {
    const lower = String(filename || "").toLowerCase();
    if (/resume|cv|简历/.test(lower)) return "resume_templates";
    if (/transcript|成绩|grade/.test(lower)) return "transcripts";
    if (/cover|letter|求职信/.test(lower)) return "cover_letters";
    return "other_documents";
  }

  function renderGithubHtml() {
    return `
      <section class="grid two">
        ${state.githubProjects
          .map(
            (project) => `
            <article class="info-card">
              <p class="eyebrow">${escapeHtml(project.status)}</p>
              <h2>${escapeHtml(project.name)}</h2>
              <p>${escapeHtml(project.summary)}</p>
              <p><strong>下一步：</strong>${escapeHtml(project.next)}</p>
              <div class="button-row">
                <button class="primary" type="button" data-open-url="${escapeHtml(project.githubUrl)}">GitHub</button>
                <button class="secondary" type="button" data-open-path="${escapeHtml(project.localDoc)}">本地说明</button>
              </div>
            </article>`,
          )
          .join("")}
      </section>
    `;
  }

  function setupDropzone(id, onFiles) {
    const zone = $(id);
    if (!zone) return;
    const input = zone.querySelector("input");
    const button = zone.querySelector("button");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      input.click();
    });
    input.addEventListener("change", () => onFiles([...input.files]));
    ["dragenter", "dragover"].forEach((eventName) => {
      zone.addEventListener(eventName, (event) => {
        event.preventDefault();
        zone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      zone.addEventListener(eventName, (event) => {
        event.preventDefault();
        zone.classList.remove("dragover");
      });
    });
    zone.addEventListener("drop", (event) => onFiles([...event.dataTransfer.files]));
  }

  async function openPath(targetPath) {
    if (!native) {
      alert("浏览器模式不能直接打开本地路径。");
      return;
    }
    await native.openPath(targetPath);
  }

  function attachOpenUrlButtons() {
    document.querySelectorAll("[data-open-url]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const url = button.getAttribute("data-open-url");
        if (!url) return;
        if (native) native.openUrl(url);
        else window.open(url, "_blank", "noopener");
      });
    });
    document.querySelectorAll("[data-open-path]").forEach((button) => {
      button.addEventListener("click", () => openPath(button.getAttribute("data-open-path")));
    });
  }

  $("sidebar-toggle").addEventListener("click", () => {
    $("app-shell").classList.toggle("collapsed");
    $("sidebar-toggle").textContent = $("app-shell").classList.contains("collapsed") ? "展开" : "收起边栏";
  });

  window.addEventListener("hashchange", render);
  setInterval(() => {
    const activeTag = document.activeElement ? document.activeElement.tagName : "";
    if (!["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) render();
  }, 60000);

  loadState().then(render);
})();
