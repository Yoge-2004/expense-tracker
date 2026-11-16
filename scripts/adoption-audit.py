#!/usr/bin/env python3
"""Feature-adoption audit: which modern capabilities does this codebase NOT use?

Run from the repository root:  python3 scripts/adoption-audit.py

A linter finds old code that is wrong. It cannot find a modern feature that was never adopted, because the old
way still works. This script counts how often each modern capability appears, per layer. A zero is only a
question, not a finding: ask whether the project has the problem the feature solves (for example, 23 hand-built
modals and no <dialog>). Counts can also mislead, so check a zero against the code before acting on it.
Read-only, standard library only. Add a line to the lists below when a language or framework release adds something.
"""
import re,glob,os,collections
def read(globs):
    out=[]
    for g in globs:
        for f in glob.glob(g,recursive=True):
            if os.path.isfile(f) and 'node_modules' not in f:
                try: out.append((f,open(f,encoding='utf-8',errors='ignore').read()))
                except: pass
    return out
def cnt(files,pat,flags=0):
    r=re.compile(pat,flags); return sum(len(r.findall(t)) for _,t in files)
def nfiles(files,pat,flags=0):
    r=re.compile(pat,flags); return sum(1 for _,t in files if r.search(t))
html=read(['frontend/*.html']); css=read(['frontend/css/**/*.css']); css=[x for x in css if not x[0].endswith(('style.css','motion-extended.css'))]
js=read(['frontend/js/**/*.js','sw.js']); java=read(['src/main/java/**/*.java']); jtest=read(['src/test/java/**/*.java'])
props=read(['src/main/resources/*.properties']); py=read(['ml/src/**/*.py']); ts=read(['mobile/app/**/*.ts*','mobile/src/**/*.ts*','mobile/components/**/*.ts*','mobile/services/**/*.ts*'])
wf=read(['.github/workflows/*.yml']); docker=read(['Dockerfile','docker/*'])
def row(label,n,note=''): print(f"  {n:6d}  {label}  {note}")
print("== HTML ==")
row("hand-built modal overlays (class modal-overlay)",cnt(html,r'class="[^"]*\bmodal-overlay\b'))
row("<dialog>",cnt(html,r'<dialog\b')); row("popover attribute",cnt(html,r'\spopover\b')); row("inert",cnt(html,r'\sinert\b'))
row("<img> total",cnt(html,r'<img\b')); row("img loading=lazy",cnt(html,r'<img[^>]*loading="lazy"')); row("img with width+height",cnt(html,r'<img(?=[^>]*\swidth=)(?=[^>]*\sheight=)[^>]*>'))
row("fetchpriority",cnt(html,r'fetchpriority')); row("<picture>/srcset",cnt(html,r'<picture|srcset=')); row("inputmode",cnt(html,r'\sinputmode=')); row("enterkeyhint",cnt(html,r'enterkeyhint'))
row("<details>",cnt(html,r'<details\b')); row("<template>",cnt(html,r'<template\b')); row("script tags",cnt(html,r'<script[^>]*\ssrc=')); row("script defer/async/module",cnt(html,r'<script[^>]*\s(defer|async|type="module")'))
row("<link rel=preload|modulepreload|preconnect>",cnt(html,r'rel="(preload|modulepreload|preconnect|dns-prefetch)"'))
print("== CSS (source modules) ==")
tot=sum(len(t.split('\n')) for _,t in css); print("  css lines:",tot)
for lab,p in [("nesting (&)",r'^\s*&[\s.:\[#>+~]|\s&\s*[.:\[]'),("@layer",r'@layer\b'),(":has(",r':has\('),(":is(/:where(",r':(is|where)\('),("@container",r'@container\b'),("clamp(",r'clamp\('),("min()/max()",r'\b(min|max)\('),("color-mix(",r'color-mix\('),("light-dark(",r'light-dark\('),("logical props (inline/block)",r'(margin|padding|border)-(inline|block)|inset-(inline|block)|\binset:'),("dvh/svh/lvh",r'\d(dvh|svh|lvh)\b'),("aspect-ratio",r'aspect-ratio'),("@property",r'@property\b'),("text-wrap",r'text-wrap'),("accent-color",r'accent-color'),("@starting-style",r'@starting-style'),("scroll-snap",r'scroll-snap'),("scroll-driven (animation-timeline)",r'animation-timeline'),("@supports",r'@supports'),("subgrid",r'subgrid'),("gap (flex/grid)",r'\bgap:'),("100vh",r'\b100vh\b'),("-webkit- prefixes",r'-webkit-(?!scrollbar|line-clamp|text-fill|background-clip|box-orient|appearance|tap-highlight|overflow-scrolling|font-smoothing|mask)'),("!important",r'!important'),("float:",r'\bfloat:')]:
    row(lab,cnt(css,p,re.M))
print("== Web JS ==")
for lab,p in [("fetch(",r'\bfetch\('),("XMLHttpRequest",r'XMLHttpRequest'),("AbortController",r'AbortController'),("AbortSignal.timeout",r'AbortSignal\.timeout'),("IntersectionObserver",r'IntersectionObserver'),("ResizeObserver",r'ResizeObserver'),("structuredClone",r'structuredClone'),("JSON.parse(JSON.stringify",r'JSON\.parse\(JSON\.stringify'),("Intl.*",r'\bIntl\.'),("toLocaleString/toLocaleDateString",r'\.toLocale(Date|Time)?String\('),(".toFixed(",r'\.toFixed\('),("URLSearchParams",r'URLSearchParams'),("navigator.clipboard",r'navigator\.clipboard'),("document.execCommand",r'execCommand'),("optional chaining ?.",r'\?\.'),("nullish ??",r'\?\?'),("#private fields",r'^\s*#\w+',),("class declarations",r'\bclass\s+\w+'),("customElements",r'customElements'),("dialog.showModal",r'showModal\('),("popover API",r'showPopover|togglePopover'),("Object.groupBy",r'Object\.groupBy'),("Promise.allSettled",r'allSettled'),("BroadcastChannel",r'BroadcastChannel'),("requestIdleCallback",r'requestIdleCallback'),("View Transitions API",r'startViewTransition'),("Web Share",r'navigator\.share'),("Screen Wake Lock/Badging",r'wakeLock|setAppBadge'),("Web Locks",r'navigator\.locks'),("localStorage",r'localStorage'),("IndexedDB",r'indexedDB'),("setTimeout(...) debounce hand-rolled",r'function\s+debounce|const\s+debounce')]:
    row(lab,cnt(js,p,re.M))
print("== Service worker / PWA ==")
sw=[x for x in js if x[0]=='sw.js']; man=read(['manifest.json'])
row("sw: navigationPreload",cnt(sw,r'navigationPreload')); row("sw: background sync",cnt(sw,r'sync')); row("sw: stale-while-revalidate",cnt(sw,r'stale|revalidate'));
row("manifest: shortcuts",cnt(man,r'"shortcuts"')); row("manifest: share_target",cnt(man,r'share_target')); row("manifest: screenshots",cnt(man,r'screenshots')); row("manifest: display_override",cnt(man,r'display_override')); row("manifest: maskable icon",cnt(man,r'maskable'))
print("== Java / Spring ==")
for lab,p in [("ProblemDetail (RFC 9457)",r'ProblemDetail'),("@ConfigurationProperties",r'@ConfigurationProperties'),("@Value(",r'@Value\('),("@Valid/@Validated",r'@Valid(ated)?\b'),("RestClient",r'RestClient\b'),("@HttpExchange",r'@HttpExchange|HttpServiceProxyFactory'),("JdbcClient",r'JdbcClient'),("Clock injection",r'\bClock\b'),("LocalDate/Instant/LocalDateTime.now()",r'(LocalDate|LocalDateTime|Instant|ZonedDateTime)\.now\(\)'),("@Retryable / @ConcurrencyLimit",r'@Retryable|@ConcurrencyLimit'),("ScopedValue",r'ScopedValue'),("ThreadLocal",r'\bThreadLocal\b|\bMDC\.put'),("sealed",r'\bsealed\b'),("pattern switch (case Type t ->)",r'case\s+[A-Z]\w*\s+\w+\s*(when[^-]*)?->'),("record patterns",r'instanceof\s+\w+\(|case\s+\w+\([^)]*\)\s*->'),("Window/ScrollPosition (keyset)",r'ScrollPosition|\bWindow<'),("Optional.ifPresentOrElse/or(",r'ifPresentOrElse|\.or\('),("Math.clamp",r'Math\.clamp'),("Collectors.teeing",r'teeing'),("List.copyOf/Map.copyOf",r'(List|Set|Map)\.copyOf'),("@Observed / Micrometer",r'@Observed|MeterRegistry|Timer\.'),("@Cacheable",r'@Cacheable'),("@Async",r'@Async'),("@Scheduled",r'@Scheduled'),("@Version (optimistic lock)",r'@Version\b'),("@EntityGraph",r'@EntityGraph'),("@Query(",r'@Query\('),("@NullMarked (JSpecify)",r'@NullMarked|jspecify'),("Lombok @Slf4j",r'@Slf4j'),("System.currentTimeMillis",r'System\.currentTimeMillis')]:
    row(lab,cnt(java,p))
print("  test: @MockitoBean",cnt(jtest,r'@MockitoBean'),"| @MockBean",cnt(jtest,r'@MockBean\b'),"| MockMvcTester",cnt(jtest,r'MockMvcTester'),"| Testcontainers",cnt(jtest,r'Testcontainers|@ServiceConnection'),"| AssertJ assertThat",cnt(jtest,r'assertThat\('),"| JUnit assertEquals",cnt(jtest,r'assertEquals\('),"| @ParameterizedTest",cnt(jtest,r'@ParameterizedTest'))
print("  props: structured logging",cnt(props,r'logging\.structured'),"| flyway/liquibase",cnt(props,r'flyway|liquibase'),"| ddl-auto",cnt(props,r'ddl-auto'),"| virtual threads",cnt(props,r'threads\.virtual'),"| http2",cnt(props,r'http2'),"| compression",cnt(props,r'server\.compression'),"| graceful shutdown",cnt(props,r'shutdown=graceful'),"| actuator probes",cnt(props,r'probes'),"| otel/tracing",cnt(props,r'tracing|otel'))
print("== Python (ML) ==")
for lab,p in [("dataclass(slots/frozen)",r'dataclass\([^)]*(slots|frozen)'),("match statements",r'^\s*match\s+\w'),("pathlib",r'pathlib|Path\('),("os.path",r'os\.path'),("StrEnum",r'StrEnum'),("TypedDict",r'TypedDict'),("pydantic",r'pydantic'),("functools.cache",r'functools\.cache|@cache\b|lru_cache'),("itertools.batched",r'batched\('),("asyncio.TaskGroup",r'TaskGroup'),("t-strings (3.14)",r'\bt"|\bt\'')]:
    row(lab,cnt(py,p,re.M))
print("== Mobile TS ==")
pk=read(['mobile/package.json']); app=read(['mobile/app.json','mobile/app.config.*'])
print("  ", re.findall(r'"(react|react-native|expo|expo-router|@shopify/flash-list|react-native-reanimated|typescript)":\s*"([^"]+)"',pk[0][1]) if pk else '')
row("newArchEnabled",cnt(app,r'newArchEnabled')); row("FlatList",cnt(ts,r'\bFlatList\b')); row("FlashList",cnt(ts,r'FlashList')); row("useMemo/useCallback",cnt(ts,r'useMemo|useCallback')); row("React.memo",cnt(ts,r'React\.memo|\bmemo\(')); row("satisfies",cnt(ts,r'\bsatisfies\b')); row("any",cnt(ts,r':\s*any\b|as any\b'))
print("== Infra / CI ==")
row("Dockerfile multi-stage (FROM count)",cnt(docker,r'^FROM',re.M)); row("USER non-root",cnt(docker,r'^USER',re.M)); row("HEALTHCHECK",cnt(docker,r'HEALTHCHECK')); row("BuildKit cache mounts",cnt(docker,r'--mount=type=cache'))
row("workflows",len(wf)); row("permissions: blocks",cnt(wf,r'^\s*permissions:',re.M)); row("concurrency:",cnt(wf,r'^\s*concurrency:',re.M)); row("actions pinned by SHA",cnt(wf,r'uses:\s*\S+@[0-9a-f]{40}')); row("actions by tag",cnt(wf,r'uses:\s*\S+@v?\d')); row("cache: (setup-* / actions/cache)",cnt(wf,r'cache:|actions/cache')); row("reusable workflow_call",cnt(wf,r'workflow_call')); row("OIDC id-token",cnt(wf,r'id-token'))
print("  dependabot/renovate:",[f for f in ('.github/dependabot.yml','renovate.json','.github/renovate.json') if os.path.exists(f)],"| editorconfig:",os.path.exists('.editorconfig'),"| pre-commit:",os.path.exists('.pre-commit-config.yaml'),"| spotless/formatter in pom:",cnt(read(['pom.xml']),r'spotless|formatter-maven|checkstyle|errorprone|nullaway|enforcer|dependency-check'))
