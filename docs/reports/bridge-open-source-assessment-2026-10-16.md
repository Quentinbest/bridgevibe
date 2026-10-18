# Open source assessment for a Web MiniBridge learning game

Research date: 2026-10-16, Asia/Shanghai. English first; Simplified Chinese follows.

## English

### Decision

**Reuse components and build the learning experience. Do not adopt a complete application yet.** Among the 19 candidates assessed below, none is established as a licensed, technically verified, complete match for beginner MiniBridge with on-demand coaching and post-hand review.

The strongest initial component choices are **DDS**, **bridge-dds-js**, and **endplay**. **macroxue/bridge-solver** is a useful alternative browser solver and analysis interface. **kduffie/bridge-engine** is a conditional rules-library candidate, not a ready MiniBridge engine. The closest teaching applications—**bridge-game-coach** and **PlayBridge**—have unresolved reuse permissions and substantive limitations.

This is a source-based selection report, not a deployment certification. Upstream tests and demos were inspected through documentation and source; they were not run locally. “Reusable” means a candidate for integration with the stated conditions, not production approval.

### Confirmed scope and working assumptions

- Confirmed: Web delivery, complete beginners, MiniBridge first, tutorials and rule explanations, optional in-play hints, and post-hand coaching.
- Working assumption: the initial learning loop can use computer-controlled seats; live multiplayer is not necessary to evaluate the learning concept.
- Web delivery does not imply browser-only computation. Browser WASM, a server solver, and offline lesson generation remain options.
- Commercial use, closed-source distribution, interface language, hosting region, budget, and the eventual bidding system remain undecided. The shortlist preserves options rather than treating any of these as settled.
- Use the EBU MiniBridge rules as the evaluation baseline. This is a research baseline, not a final product rulebook decision. A custom simplification should be named explicitly.

### Search coverage and evidence quality

Discovery covered GitHub repository search and web search, follow-through to dependencies, SourceForge, GitLab-targeted web queries, package documentation, and EBU/EBED teaching resources. Queries included `minibridge`, `"contract bridge"`, `bridge card game language:TypeScript`, `bridge card game language:JavaScript`, `bridge teaching`, `bridge-dds`, and bridge AI/solver searches. GitHub result pages were sampled up to 30 results per targeted query; irrelevant blockchain, networking, robotics, and other card-game variants were excluded.

The matrix contains 19 relevant candidates, with deeper file inspection for the leading components and teaching apps. This is a broad, bounded investigation; it does not claim to enumerate every repository or every fork. GitLab-targeted searches did not produce a better verified candidate in this pass. SourceForge's PyBridge provides an additional historical comparison.

Evidence levels:

- **Source inspected:** selected implementation files, manifests, licenses, or repository trees were read in addition to descriptions.
- **Documentation screened:** first-party documentation and/or repository metadata supports the screening judgment; implementation remains unverified.
- A repository's latest push is a maintenance signal only. It can reflect a branch update or dependency change and is not proof of a maintained release. Dates below come from GitHub repository metadata unless otherwise stated.

### Candidate matrix

| Candidate | Evidence and maintenance signal | License found | Reuse decision for this product |
|---|---|---|---|
| [dds-bridge/dds](https://github.com/dds-bridge/dds) | Source/docs; pushed 2026-10-15; C++, Python bindings, WASM build docs | Apache-2.0 | **Primary analysis candidate.** Exact all-hands-visible analysis; needs a game and teaching layer. |
| [bookchris/bridge-dds-js](https://github.com/bookchris/bridge-dds-js) | Source/docs; pushed 2025-05-22; TypeScript wrapper and worker examples | Apache-2.0 | **Primary browser integration candidate.** Check wrapper/core versions and browser performance. |
| [macroxue/bridge-solver](https://github.com/macroxue/bridge-solver) | Source/docs; pushed 2026-10-03; C++/WASM, browser analysis and shuffle approximation | MIT or Apache-2.0 | **Alternative solver and analysis UI.** Adapt integration; do not assume its benchmarks predict our app. |
| [dominicprice/endplay](https://github.com/dominicprice/endplay) | Docs/license; pushed 2025-03-21; Python deal generation, parsers, DDS analysis | MIT; bundled components need their notices | **Prefer for lesson authoring and analysis jobs.** Not a browser game engine. |
| [kduffie/bridge-engine](https://github.com/kduffie/bridge-engine) | Source; pushed 2022-01-11; TypeScript, package 0.2.0 | MIT | **Conditional partial reuse.** Rules objects and player interfaces; replace contract assignment and validate packaging. |
| [lorserker/ben](https://github.com/lorserker/ben) | Docs/API/license; pushed 2026-10-11; Python, neural models, DDS | GPL-3.0 | **Later-stage robot candidate.** Full-bridge inference assumptions and deployment cost need adaptation. |
| [jinsoowhang/bridge-game-coach](https://github.com/jinsoowhang/bridge-game-coach) | Source; pushed 2026-03-14; React/TypeScript, lessons and templated hints | No project-wide license found in checked tree, README, root/engine manifests | **Closest teaching reference; hold code reuse.** No verified MiniBridge mode; coaching quality needs work. |
| [maxgiraldo/playbridge](https://github.com/maxgiraldo/playbridge) | Source; pushed 2026-09-10; Python/Web, MiniBridge, lessons, review | No project-wide license found in tree/README | **Closest MiniBridge product reference; hold code reuse.** Rule differences and limited custom solver. |
| [brannondorsey/nickel-bridge](https://github.com/brannondorsey/nickel-bridge) | Source/manifests; pushed 2026-10-04; React/Fastify, duplicate tournaments, bid grading | No project-wide license found; separate dependency/content licenses documented | **Reference or permission-dependent reuse.** Competition and SAYC focus diverge from first lessons. |
| [PGreen90/Learn-Bridge](https://github.com/PGreen90/Learn-Bridge) | Tree/manifests/docs; pushed 2026-10-13; Swedish teaching app, bidding and play | No project-wide license found in checked tree/README/manifest | **Reference or permission-dependent reuse.** Advanced bidding emphasis; README architecture is stale. |
| [GuCasper/btf-minibridge-dds](https://github.com/GuCasper/btf-minibridge-dds) | Source; pushed 2026-10-05; Node/Docker solver service | Apache-2.0 | **Small server-adapter reference.** It is not the MiniBridge teaching site itself. |
| [frankwallis/redouble](https://github.com/frankwallis/redouble) | Manifest/license/docs; pushed 2022-07-19; React 0.14, Webpack 1, Koa 1 | MIT | **Selective salvage only.** Whole-app modernization likely outweighs its benefit for this scope. |
| [ebridge/bridge-web](https://github.com/ebridge/bridge-web) | Documentation/metadata; pushed 2023-01-24; Next.js/Express/PostgreSQL multiplayer | GitHub did not identify a license; reuse not established | **Defer.** Multiplayer infrastructure is outside the initial learning loop. |
| [juef17/LibreBridge](https://github.com/juef17/LibreBridge) | Documentation/metadata; pushed 2026-06-11; Qt 6 | GPL-3.0 | **Do not use as Web foundation.** README still describes random AI and an unplayable GUI. |
| [pslusarz/gnubridge](https://github.com/pslusarz/gnubridge) | Documentation/metadata; pushed 2025-04-05; Java/Gradle | GPL-3.0 | **Historical algorithm reference.** Desktop/JVM focus; README warns of infrequent updates. |
| [PyBridge](https://sourceforge.net/projects/pybridge/) | SourceForge documentation; page updated 2013-04-17, listed 0.3.0 files from 2007 | GPLv2 per project page | **Exclude as foundation.** Alpha desktop/network application with substantial modernization burden. |
| [harukaki/brl](https://github.com/harukaki/brl) | Documentation/metadata; pushed 2024-07-25; JAX bidding training and pretrained parameters | Apache-2.0 at repository level | **Defer to bidding phase.** No MiniBridge play/teaching product; audit model/data provenance separately. |
| [sotetsuk/pgx](https://github.com/sotetsuk/pgx/blob/main/docs/bridge_bidding.md) | Bridge documentation/metadata; pushed 2025-03-06 | Apache-2.0 at repository level | **Research tool only for now.** Bridge environment focuses on bidding and substitutes DDS results for play. |
| [google-deepmind/open_spiel](https://github.com/google-deepmind/open_spiel/blob/master/open_spiel/games/bridge/bridge.h) | Bridge source/license inspected; activity not separately quantified | Apache-2.0; check dependencies separately | **Validation/research reference.** Full bridge state and observations; large research framework, no beginner UI. |

### What the implementation inspection changes

**1. Skipping bidding is not MiniBridge.** `bridge-engine` exposes automatic contract assignment, but its implementation compares `totalPoints`, randomly breaks equal partnership totals, and chooses the contract automatically. The EBU baseline uses announced high-card points, redeals a 20–20 split, and lets declarer choose after seeing dummy. Reuse the lower-level objects only if they pass tests; replace the setup flow. Its package also points `main` to a sample runner, and declares no test script, so it should not be adopted as a routine modern package without an integration check. [Contract assignment source](https://github.com/kduffie/bridge-engine/blob/aa942930747ab4fda008af492e8b6f61f6e08fd1/src/contract-assigner.ts), [manifest](https://github.com/kduffie/bridge-engine/blob/aa942930747ab4fda008af492e8b6f61f6e08fd1/package.json), [EBU baseline](https://www.ebu.co.uk/information-resources/11-easy-steps-play-minibridge).

**2. PlayBridge is relevant but cannot be treated as a finished teaching engine.** Its `_deal` selects North–South on equal partnership HCP and fixes certain declarer ties to South/West. These differ from the EBU baseline. Its `engine/dds.py` is a custom Python search, not the upstream DDS library: search stops at 40,000 nodes, and `engine_card` declines positions with more than 24 cards remaining. A function can fall back to an HCP estimate. These are material limits for claims about precise coaching. [Game source](https://github.com/maxgiraldo/playbridge/blob/9aa024f721f33bb9740908b1d3c7b98d7e35ad34/engine/game.py), [solver source](https://github.com/maxgiraldo/playbridge/blob/9aa024f721f33bb9740908b1d3c7b98d7e35ad34/engine/dds.py).

**3. Bridge Coach demonstrates the interaction, not validated expert instruction.** Its hints are constructed by rules and text templates; this does not require a language model. One lead explanation calls a suit the longest when its length is merely at least four, without comparing other suits in that explanation branch. That can misdescribe the suggested move. The README's test count is an upstream claim, not a locally reproduced result. [Coaching source](https://github.com/jinsoowhang/bridge-game-coach/blob/8586fd98914047d2899c98e2fd7d7bf64c8f2459/packages/engine/src/coaching.ts), [README](https://github.com/jinsoowhang/bridge-game-coach/blob/8586fd98914047d2899c98e2fd7d7bf64c8f2459/README.md).

**4. Browser DDS choices have different costs.** `bridge-dds-js` has a blocking API and worker examples. Its package is named `bridge-dds`, despite a different installation spelling in its README. Current upstream DDS also has WASM support, but its documented threaded Web build requires cross-origin isolation and declares 256 MB initial memory. These paths need separate compatibility tests; the wrapper must not be assumed to track current DDS automatically. [Wrapper manifest](https://github.com/bookchris/bridge-dds-js/blob/23c72429f5cb382d0f8805ea1ac44658c1116006/package.json), [wrapper README](https://github.com/bookchris/bridge-dds-js/blob/23c72429f5cb382d0f8805ea1ac44658c1116006/README.md), [upstream WASM guide](https://github.com/dds-bridge/dds/blob/27f3720676eb43f91a487f53a68c4298e2068c71/docs/wasm_build.md).

**5. Recent activity does not make descriptions reliable.** Learn-Bridge's README says there is no backend, while the inspected tree contains `api-src/` and the manifest includes Supabase and an API build step. Nickel Bridge documents grading bids by the model's own policy probabilities; agreement with that policy is not independent evidence of instructional correctness. These projects deserve targeted validation rather than a feature-list-based adoption decision. [Learn-Bridge manifest](https://github.com/PGreen90/Learn-Bridge/blob/c14c99a1d989b764bc8fa9eab3cd0e3ec9971f2f/package.json), [Nickel Bridge README](https://github.com/brannondorsey/nickel-bridge/blob/92a81b5e81cb7aac2eabc147e82f18e0040b512e/README.md).

### The AI coach needs two information modes

Double-dummy analysis assumes all hands are known and play is optimal. It is valuable for demonstrating lines and explaining outcomes after a deal. It does not, by itself, establish what a player should have chosen with hidden cards. [endplay's explanation](https://endplay.readthedocs.io/en/latest/pages/readme/04_tutorial.html).

Proposed design:

1. **During play:** restrict the coach to the learner's hand, exposed dummy, announced HCP, played cards, and deductions justified by that history. Use curated lesson explanations first. Later, sample hidden hands consistent with this information and evaluate candidate plays; describe sampling results as estimates.
2. **After the hand:** allow all-hands-visible analysis, explicitly label that perspective, and distinguish a poor decision from an unlucky result.
3. **Language generation:** optionally turn verified facts into clear explanations. The rules engine determines legal actions; an evidence-producing evaluator supports the advice. A language model should not invent card locations or adjudicate legality.
4. **Counterexample:** a sound finesse can fail because of an unknown defender's holding. Do not mark it a bad decision merely because a full-information solver would choose another line on that particular deal.

A credible coaching evaluation should also swap unseen cards while keeping the visible history and announced HCP consistent. Advice must not change because the software secretly knows which of those indistinguishable layouts is real. Sampling with DDS remains an approximation, not a proven optimal imperfect-information policy.

### Teaching content and remaining product work

The EBU baseline includes a distinct pre-play process, dummy exposure before contract choice, follow-suit obligations, and declarer control of dummy. Scoring also needs a named MiniBridge convention rather than an unmodified duplicate-bridge scorer. [EBU rules](https://www.ebu.co.uk/information-resources/11-easy-steps-play-minibridge), [EBU scoring](https://www.ebu.co.uk/information-resources/how-score-minibridge).

Recommended learning sequence: card ranks and suits → following suit and winning tricks → partnership and dummy → no-trump planning → trump play → HCP and contract choice → short review and retry. Use short prepared exercises before random full deals. This sequence is a product recommendation, not a claim about a validated curriculum.

[EBED teaching resources](https://www.ebedcio.org.uk/youth/development/teaching-resources/) include MiniBridge teaching hands and PBN files. They can inform coverage and exercise design, but public download does not establish permission to redistribute lesson text, diagrams, or collections. Create original explanations and deals or obtain explicit reuse rights.

Work still required: lessons and progression, rule explanation UI, accessible card interaction, a correct MiniBridge setup/scoring layer, visible-information coaching, review/retry, learning progress, and a teacher-reviewed evaluation set. No assessed component establishes improved learning outcomes by itself.

### License conditions that affect selection

- MIT/Apache candidates preserve flexibility, subject to the actual license and required notices. Inspect dependencies, fonts, images, and bundled binaries separately. [MIT example](https://github.com/kduffie/bridge-engine/blob/main/LICENSE), [Apache example](https://github.com/dds-bridge/dds/blob/develop/LICENSE).
- A public repository is not automatically permission to copy and redistribute its code. For the applications with no project-wide grant found, the current decision is **hold reuse pending clarification**, not “open-source and ready.” No maintainers have been contacted. [GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).
- BEN's GPL is not a ban on commercial use. Obligations depend on what is combined and distributed; server execution and browser-delivered code are different situations. Do not assume a separate API automatically settles all licensing questions. [BEN license](https://github.com/lorserker/ben/blob/main/LICENSE), [GNU FAQ](https://www.gnu.org/licenses/gpl-faq.en.html).
- A repository's code license does not independently settle the provenance of training data, model weights, or imported teaching content. Nickel Bridge itself identifies multiple licenses for bundled work; its dependency licenses do not grant rights to all of its original application code. [Bundled-work notices](https://github.com/brannondorsey/nickel-bridge#licenses-of-bundled-work).

### Recommended route and the next validation gate

**Preferred:** a small purpose-built Web teaching app, a deterministic MiniBridge rules layer, DDS behind a replaceable analysis interface, and endplay for preparing lessons. Compare `bridge-dds-js` with current upstream DDS WASM before choosing the browser binding. Keep `macroxue/bridge-solver` as the alternative. Borrow licensed rule components from `bridge-engine` only where doing so reduces work after validation.

**Conditional alternative:** if a suitable reuse license becomes available for Bridge Coach or PlayBridge, test whether adapting that application is faster than building the teaching layer. The observed correctness gaps still need fixing.

**Defer:** BEN, learned bidding, multiplayer tournaments, and training a new model until the MiniBridge learning loop works. BEN's documented play API takes auction context, so a no-auction MiniBridge adapter must account for announced HCP rather than invent a misleading auction. [BEN API](https://github.com/lorserker/ben/blob/72653ec1b5c17116faea229e9b975ea5622aa1f7/README-api.md).

Before implementation selection becomes final, run one bounded integration experiment:

| Check | Proposed acceptance condition |
|---|---|
| MiniBridge correctness | Cases cover 20–20 redeal, declarer ties, dummy visibility, contract choice, follow suit, trump winners, turn order, and selected scoring convention. |
| Solver integration | Known deals/endings match reference results; results are translated into the correct declaring/defending perspective. |
| Browser behavior | Test Chrome, Safari, Firefox and a representative phone browser; measure cold load, memory, median/p95 solve time and hard-deal timeout behavior. No performance threshold is claimed measured yet. |
| Information discipline | Bot and coach receive only permitted observations; hidden-card permutation checks pass. |
| Coaching correctness | A bridge teacher reviews a small fixed set covering safe plays, equivalent choices, losing finesses and ambiguous situations; every explanation has supporting facts. |
| Learning value | Beginners can complete a guided deal and explain the lesson afterward; assistance can be removed without breaking the flow. |
| Reuse rights | Pin each chosen version and record license, notices, asset rights and any model/data permissions. |

### Verification record

Read-only GitHub API and web retrieval checked repository metadata, selected trees, licenses, manifests, implementation and official rule pages. Direct shell access to GitHub failed DNS resolution; the connected GitHub tools provided the source instead. No upstream package was installed or executed. No application was built, deployed, forked, or published.

Ten leading snapshots were identified through the default branch commit API; immutable source links above use these commits:

| Repository | Commit |
|---|---|
| dds-bridge/dds | `27f3720676eb43f91a487f53a68c4298e2068c71` |
| bookchris/bridge-dds-js | `23c72429f5cb382d0f8805ea1ac44658c1116006` |
| macroxue/bridge-solver | `630705d97bc9205b7310ce6cecafbfb031b289e6` |
| dominicprice/endplay | `260af100d7dacc0e81babd839d5596ca7f20017a` |
| kduffie/bridge-engine | `aa942930747ab4fda008af492e8b6f61f6e08fd1` |
| lorserker/ben | `72653ec1b5c17116faea229e9b975ea5622aa1f7` |
| jinsoowhang/bridge-game-coach | `8586fd98914047d2899c98e2fd7d7bf64c8f2459` |
| maxgiraldo/playbridge | `9aa024f721f33bb9740908b1d3c7b98d7e35ad34` |
| brannondorsey/nickel-bridge | `92a81b5e81cb7aac2eabc147e82f18e0040b512e` |
| PGreen90/Learn-Bridge | `c14c99a1d989b764bc8fa9eab3cd0e3ec9971f2f` |

## 简体中文

### 结论

**建议复用底层组件，自行构建教学体验；目前不建议整体采用某个现成应用。** 本次评估的 19 个候选中，没有一个已被证实同时满足：复用授权明确、技术验证通过、面向零基础的迷你桥牌、按需提示及赛后教学复盘。

优先考察 **DDS、bridge-dds-js 和 endplay**。**macroxue/bridge-solver** 可作为浏览器求解器与分析界面的备选。**kduffie/bridge-engine** 只能作为有条件复用的规则库，不能当作现成的迷你桥牌引擎。最接近教学设想的 **bridge-game-coach** 和 **PlayBridge**，都存在复用授权不明确及功能质量问题。

这是基于源码与一手资料的选型研究，不是上线验收。未在本地运行上游测试或实际试玩；“可复用”表示值得进入集成验证，并不表示已经达到生产可用标准。

### 已确认范围与研究假设

- 已确认：Web 端、零基础玩家、从迷你桥牌开始、教程与规则讲解、打牌时按需提示、每副牌结束后指导。
- 暂按电脑补齐其他座位评估；实时多人对局不是验证教学价值的必要条件。
- Web 端不等于所有计算都必须在浏览器执行。浏览器 WASM、服务端求解、离线生成教学牌都保留为选项。
- 是否商业化、是否闭源、界面语言、部署地区、预算及未来叫牌体系均未确定。本次推荐尽量保留这些选择。
- 暂用 EBU 迷你桥牌规则作为比较基准，并非已经决定最终产品规则。若采用自定义简化规则，应清楚标明。

### 覆盖范围与证据强度

检索覆盖 GitHub 仓库搜索与网页搜索、候选项目依赖、SourceForge、面向 GitLab 的搜索、软件包文档，以及 EBU/EBED 教学资料。主要关键词见英文部分，每个针对性 GitHub 查询最多查看 30 条结果，并排除区块链跨链、通信桥接、机器人中间件和其他牌类变体。

下表包含 19 个相关候选，对重点组件与教学应用进一步检查了源码、目录、许可证或依赖清单。这是范围较广但有边界的研究，不声称穷尽所有仓库和分支。本次 GitLab 搜索未带来更合适且已核实的候选；SourceForge 的 PyBridge 用作历史方案对照。

“源码检查”只表示读过相关文件，不代表完整代码审计；“文档筛选”表示依据项目自身资料作出初筛。最近推送日期只反映仓库活动，不能证明有稳定版本或持续维护。以下日期与英文表相同，来自 GitHub 元数据；PyBridge 除外。

### 候选项目与复用判断

| 项目 | 核查程度与维护信号 | 许可证 | 针对本产品的判断 |
|---|---|---|---|
| [dds-bridge/dds](https://github.com/dds-bridge/dds) | 源码/文档；2026-10-15 推送；C++、Python、WASM | Apache-2.0 | **主要分析组件候选**；提供全明手分析，教学与对局层需另做。 |
| [bookchris/bridge-dds-js](https://github.com/bookchris/bridge-dds-js) | 源码/文档；2025-05-22；TypeScript 包装与 Worker 示例 | Apache-2.0 | **主要浏览器接入候选**；需要核实内核版本及浏览器表现。 |
| [macroxue/bridge-solver](https://github.com/macroxue/bridge-solver) | 源码/文档；2026-10-03；WASM、分析界面、洗牌近似分析 | MIT 或 Apache-2.0 | **求解器及分析界面备选**；需适配，不能直接套用其性能数据。 |
| [dominicprice/endplay](https://github.com/dominicprice/endplay) | 文档/许可证；2025-03-21；Python 发牌、格式解析、DDS | MIT；另检查捆绑组件声明 | **优先用于教学牌制作和后台分析**；不是浏览器游戏引擎。 |
| [kduffie/bridge-engine](https://github.com/kduffie/bridge-engine) | 源码；2022-01-11；TypeScript，0.2.0 | MIT | **有条件部分复用**；保留有用规则对象，重做定约流程并验证打包。 |
| [lorserker/ben](https://github.com/lorserker/ben) | 文档/API/许可证；2026-10-11；Python、神经网络、DDS | GPL-3.0 | **后续电脑牌手候选**；迷你桥牌适配、运行成本和部署方式待验证。 |
| [jinsoowhang/bridge-game-coach](https://github.com/jinsoowhang/bridge-game-coach) | 源码；2026-03-14；React/TypeScript、课程、模板提示 | 已查目录、README、根及引擎清单未发现整体授权 | **最接近教学交互的参考**；暂缓复用代码，迷你桥牌及解释质量有缺口。 |
| [maxgiraldo/playbridge](https://github.com/maxgiraldo/playbridge) | 源码；2026-09-10；Python/Web、迷你桥牌、课程与复盘 | 已查目录/README 未发现整体授权 | **最接近迷你桥牌产品的参考**；规则有差异，自制求解器能力有限。 |
| [brannondorsey/nickel-bridge](https://github.com/brannondorsey/nickel-bridge) | 源码/清单；2026-10-04；比赛、叫牌评分、复盘 | 未发现整体授权；部分依赖及内容有单独许可证 | **参考或取得授权后复用**；SAYC 与比赛导向不适合直接作为新手第一课。 |
| [PGreen90/Learn-Bridge](https://github.com/PGreen90/Learn-Bridge) | 目录/清单/文档；2026-10-13；瑞典语教学应用 | 已查目录/README/清单未发现整体授权 | **参考或取得授权后复用**；较偏进阶叫牌，README 架构描述已落后。 |
| [GuCasper/btf-minibridge-dds](https://github.com/GuCasper/btf-minibridge-dds) | 源码；2026-10-05；Node/Docker 求解服务 | Apache-2.0 | **服务端适配参考**；只有服务组件，并不是完整教学网站。 |
| [frankwallis/redouble](https://github.com/frankwallis/redouble) | 清单/许可证/文档；2022-07-19；React 0.14、Webpack 1、Koa 1 | MIT | **仅考虑提取局部逻辑**；整体翻新对当前需求可能不划算。 |
| [ebridge/bridge-web](https://github.com/ebridge/bridge-web) | 文档/元数据；2023-01-24；Next.js/Express/PostgreSQL | GitHub 未识别许可证，复用权未确认 | **暂不采用**；多人平台不是初版教学循环的重点。 |
| [juef17/LibreBridge](https://github.com/juef17/LibreBridge) | 文档/元数据；2026-06-11；Qt 6 | GPL-3.0 | **不作为 Web 基础**；README 仍列随机 AI 和未可玩的 GUI。 |
| [pslusarz/gnubridge](https://github.com/pslusarz/gnubridge) | 文档/元数据；2025-04-05；Java/Gradle | GPL-3.0 | **历史算法参考**；面向桌面/JVM，README 明示更新不频繁。 |
| [PyBridge](https://sourceforge.net/projects/pybridge/) | 项目页 2013-04-17 更新，0.3.0 下载文件来自 2007 年 | 项目页标 GPLv2 | **排除作为基础**；Alpha 桌面联网应用，迁移负担大。 |
| [harukaki/brl](https://github.com/harukaki/brl) | 文档/元数据；2024-07-25；JAX 叫牌训练及参数 | 仓库 Apache-2.0 | **留到叫牌阶段**；模型与数据来源另审，不提供迷你桥牌教学产品。 |
| [sotetsuk/pgx](https://github.com/sotetsuk/pgx/blob/main/docs/bridge_bidding.md) | 桥牌文档/元数据；2025-03-06 | 仓库 Apache-2.0 | **研究工具**；桥牌环境聚焦叫牌，以 DDS 结果替代出牌阶段。 |
| [google-deepmind/open_spiel](https://github.com/google-deepmind/open_spiel/blob/master/open_spiel/games/bridge/bridge.h) | 桥牌源码/许可证；未单独量化活跃度 | Apache-2.0，依赖另审 | **规则验证与算法研究参考**；框架较大，没有新手教学界面。 |

### 源码核查带来的关键修正

**“跳过叫牌”不等于迷你桥牌。** `bridge-engine` 的自动定约使用 `totalPoints`，双方点力相同会随机选边，并替玩家决定定约。EBU 基准使用公开宣布的大牌点，20–20 时重发，由庄家看到明手后选定约。若复用该库，必须重做起始流程。它的 `main` 还指向示例程序，清单中没有测试命令，不能未经验证就当作成熟软件包接入。[定约源码](https://github.com/kduffie/bridge-engine/blob/aa942930747ab4fda008af492e8b6f61f6e08fd1/src/contract-assigner.ts)、[软件包清单](https://github.com/kduffie/bridge-engine/blob/aa942930747ab4fda008af492e8b6f61f6e08fd1/package.json)、[EBU 规则](https://www.ebu.co.uk/information-resources/11-easy-steps-play-minibridge)。

**PlayBridge 的名称与功能接近需求，但不能据此认定成熟。** `_deal` 把双方大牌点相同的牌分配给南北方；同伴点力相同的部分情况固定选择南家或西家，与 EBU 基准不同。其 `engine/dds.py` 是自制 Python 搜索，并非上游 DDS：搜索上限 40,000 节点，`engine_card` 对剩余超过 24 张牌的局面直接不求解，另有函数会退回到大牌点估算。这会影响“精确指导”的可信度。[规则源码](https://github.com/maxgiraldo/playbridge/blob/9aa024f721f33bb9740908b1d3c7b98d7e35ad34/engine/game.py)、[求解源码](https://github.com/maxgiraldo/playbridge/blob/9aa024f721f33bb9740908b1d3c7b98d7e35ad34/engine/dds.py)。

**Bridge Coach 更适合参考交互方式。** 它通过规则与文本模板生成提示，不依赖语言模型。一个首攻解释分支只检查所选花色至少四张，就称其为“最长套”，并未在该分支比较其他花色，可能给出不准确的解释。README 的测试数量只是上游声明，本次未复现。[提示源码](https://github.com/jinsoowhang/bridge-game-coach/blob/8586fd98914047d2899c98e2fd7d7bf64c8f2459/packages/engine/src/coaching.ts)、[README](https://github.com/jinsoowhang/bridge-game-coach/blob/8586fd98914047d2899c98e2fd7d7bf64c8f2459/README.md)。

**不同浏览器求解方案的成本不同。** `bridge-dds-js` 的接口会阻塞，需用 Worker 避免卡住界面。清单中的包名是 `bridge-dds`，README 安装写法却不一致。当前 DDS 上游已有 WASM，但文档中的多线程 Web 构建要求跨源隔离，初始内存配置为 256 MB。应分别验证，不能假定旧包装库自动跟随新版 DDS。[包装库清单](https://github.com/bookchris/bridge-dds-js/blob/23c72429f5cb382d0f8805ea1ac44658c1116006/package.json)、[包装库说明](https://github.com/bookchris/bridge-dds-js/blob/23c72429f5cb382d0f8805ea1ac44658c1116006/README.md)、[上游 WASM 文档](https://github.com/dds-bridge/dds/blob/27f3720676eb43f91a487f53a68c4298e2068c71/docs/wasm_build.md)。

**最近有更新也不代表描述可靠。** Learn-Bridge 的 README 声称没有后端，但源码目录有 `api-src/`，清单包含 Supabase 和 API 构建步骤。Nickel Bridge 根据自身模型的叫牌概率评分；与模型意见一致，不等于教学上正确。这些项目都需要针对性验证。[Learn-Bridge 清单](https://github.com/PGreen90/Learn-Bridge/blob/c14c99a1d989b764bc8fa9eab3cd0e3ec9971f2f/package.json)、[Nickel Bridge 说明](https://github.com/brannondorsey/nickel-bridge/blob/92a81b5e81cb7aac2eabc147e82f18e0040b512e/README.md)。

### AI 教练必须区分两种信息视角

双明手求解假设所有手牌都已知，且各方都采用最优打法。它适合复盘与演示，但不能单独证明玩家在看不到暗牌时应该如何选择。[endplay 说明](https://endplay.readthedocs.io/en/latest/pages/readme/04_tutorial.html)。

建议的教学结构：

1. **打牌过程中：** 只使用玩家手牌、已经公开的明手、已宣布的大牌点、出牌历史及合理推断。先用经过审核的课程提示；以后再对符合已知条件的暗牌分布采样，评估打法，并明确这是估计。
2. **每副牌结束后：** 可以查看四家牌，但明确标注全明手视角，把决策错误与结果不走运分开。
3. **语言模型：** 可负责把已验证的事实讲清楚。合法动作由规则引擎决定，建议由能提供依据的分析组件支持，不能让模型凭空判断暗牌位置或裁定规则。
4. **典型反例：** 一个合理的飞牌可能因为未知的防守方牌张位置而失败，不能仅因全明手求解器在实际牌局中会选另一条路线，就判玩家决策错误。

验证时还应交换玩家看不到的牌，并保持公开信息与大牌点不变。如果两种布局对玩家不可区分，教练不应因为程序知道真实布局而改变建议。DDS 配合采样仍是近似方法，不是已经证明最优的不完全信息策略。

### 教学内容与仍需自建的部分

EBU 基准具有独立的开局流程，明手在选择定约前公开；之后还要正确处理跟牌义务和庄家控制明手。计分也必须选定明确的迷你桥牌版本，不能直接照搬完整复式桥牌计分。[规则](https://www.ebu.co.uk/information-resources/11-easy-steps-play-minibridge)、[计分](https://www.ebu.co.uk/information-resources/how-score-minibridge)。

建议课程顺序：花色与牌张大小 → 跟牌与赢墩 → 同伴与明手 → 无将规划 → 将牌 → 大牌点与定约选择 → 简短复盘与重试。先练短小的预设局面，再过渡到完整随机牌。这是产品设计建议，尚未经过教学效果验证。

[EBED 教学资源](https://www.ebedcio.org.uk/youth/development/teaching-resources/) 提供迷你桥牌教学牌和 PBN 文件，可用于了解教学覆盖范围。但可下载不等于获得教材文本、图示或牌例合集的再发布权。产品中应使用原创内容，或取得明确复用许可。

仍需制作：课程与进阶路径、规则解释界面、易用且无障碍的牌桌交互、迷你桥牌起始流程和计分、符合可见信息范围的教练、复盘重试、学习记录，以及由桥牌教师审核的评估题。现有组件本身不能证明能提高玩家水平。

### 影响选型的授权条件

- MIT/Apache 组件保留较多产品选择，但需遵守实际许可证与署名要求；依赖、字体、图片和二进制文件另查。[MIT 示例](https://github.com/kduffie/bridge-engine/blob/main/LICENSE)、[Apache 示例](https://github.com/dds-bridge/dds/blob/develop/LICENSE)。
- 仓库公开不代表可以任意复制和分发。对未发现整体授权的项目，当前判断是**暂缓复用，等待授权澄清**。本次没有联系维护者。[GitHub 授权说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)。
- BEN 的 GPL 不等于禁止商业使用。义务与如何组合、如何分发有关；服务端执行与把程序发送到浏览器不同，也不能认为拆成 API 就自动解决一切授权问题。[BEN 许可证](https://github.com/lorserker/ben/blob/main/LICENSE)、[GNU FAQ](https://www.gnu.org/licenses/gpl-faq.en.html)。
- 代码许可证不能单独证明训练数据、模型参数和教学内容的来源授权。Nickel Bridge 已分别列出部分依赖与内容的许可证，但这些不会自动覆盖其原创应用代码。[第三方声明](https://github.com/brannondorsey/nickel-bridge#licenses-of-bundled-work)。

### 推荐路线与下一步验证

**优先路线：** 自建小型 Web 教学应用与确定性的迷你桥牌规则层，以可替换的分析接口接入 DDS，用 endplay 制作教学牌。先比较 `bridge-dds-js` 与当前上游 DDS WASM，再选浏览器接入方案；保留 `macroxue/bridge-solver` 备选。只有经过验证确实能节省工作时，才从 `bridge-engine` 复用局部规则组件。

**条件路线：** 若 Bridge Coach 或 PlayBridge 取得合适授权，再验证改造现成应用是否更省工作。前述规则和教学解释问题仍需修复。

**延后处理：** BEN、学习型叫牌、多人比赛及自行训练模型。先证明迷你桥牌教学循环有效。BEN 的出牌 API 接受叫牌上下文，接入无叫牌的迷你桥牌时，必须正确处理公开大牌点，不能编造一段会误导推断的叫牌过程。[BEN API](https://github.com/lorserker/ben/blob/72653ec1b5c17116faea229e9b975ea5622aa1f7/README-api.md)。

正式确定技术选型前，建议完成一次范围明确的集成验证：

| 核查项 | 建议验收条件 |
|---|---|
| 迷你桥牌规则 | 覆盖 20–20 重发、庄家点力平手、明手公开时机、选择定约、跟牌、将牌赢墩、轮次和所选计分。 |
| 求解结果 | 已知牌与残局匹配参考结果，正确换算庄家/防守方视角。 |
| 浏览器表现 | 测 Chrome、Safari、Firefox 和代表性手机浏览器；记录冷启动、内存、中位数/p95 求解耗时及困难牌超时。当前没有实测性能结论。 |
| 信息边界 | 机器人与教练只接收允许的信息，暗牌交换检验通过。 |
| 教学解释 | 桥牌教师审核安全打法、等价选择、飞牌失败及不确定局面，每条解释都有事实依据。 |
| 学习价值 | 新手能完成引导牌并解释所学内容；减少提示后仍能继续。 |
| 复用权利 | 固定选用版本，记录许可证、声明、素材权利及模型/数据许可。 |

### 验证记录

本次通过只读 GitHub API 与网页核查了元数据、相关目录、许可证、依赖清单、实现文件与官方规则。终端直连 GitHub 时 DNS 解析失败，随后通过已连接的 GitHub 工具取得源码。没有安装或执行上游软件，没有构建、部署、fork 或发布应用。英文部分列出了 10 个重点项目的提交标识，文中关键源码链接已固定到这些版本。
