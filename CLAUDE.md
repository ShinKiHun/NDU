# NDU Site — Project Context

이 디렉토리는 **NDU 프로젝트 결과를 보여주는 정적 인터랙티브 사이트**의 소스이자 GitHub Pages 배포 디렉토리. NDU 본체(메타다이내믹스 계산·분석)는 `/DATA/user_scratch/khshin/NDU/` 에 있고 그쪽 CLAUDE.md를 함께 참조.

## 목적

bimetallic cluster phase space 결과(formation/mixing/EAH, FES, metaMD trajectory)를 **포스터·발표용**으로 외부에 공개하는 사이트. 계산이 끝난 페어만 올라가며, 신규 페어/support는 `build_data.py` 한 번 + asset 복사 + push만으로 자동 추가됨.

## 위치 / 배포

| 경로 | 역할 |
|------|------|
| `/home/khshin/NDU/` | git repo 루트 (사이트 소스 = repo 그 자체) |
| `/DATA/user_scratch/khshin/NDU/` | 실제 계산/분석 데이터 source-of-truth |
| `https://github.com/ShinKiHun/NDU` | GitHub repo (SSH 인증) |
| `https://shinkihun.github.io/NDU/` | 라이브 URL (Pages: main / root) |

GitHub Pages source는 **main / root** (docs 폴더 안 씀, 사이트 파일이 repo 루트에 있음).

## 파일 구조

```
/home/khshin/NDU/
├── index.html          # 5 페이지 layout (Home / Gas / Supported / Methods / Refs) — hash routing
├── styles.css          # dark+bright dual theme (곧 단일 cosmic theme로 교체 예정)
├── app.js              # Plotly + 갤러리 + 라우터 + 테마 토글
├── data.json           # eoh.txt → 파싱한 EOH + FES 인벤토리 + GIF 메타
├── build_data.py       # NDU analysis output → data.json 변환기
├── ref/                # 미사이트 자산 (Gemini 원본 PNG 등) — repo에 보관, 사이트에선 직접 안 씀
├── backup/2026-04-30/  # Stellar Grid 적용 직전 dual-theme 스냅샷 (index/styles/app/themes)
└── assets/
    ├── hero/           # cluster-gas.jpg, cluster-supported.jpg (Gemini 2-panel 잘라낸 hero 이미지)
    ├── preview/        # 테마 시안 (themes.html + theme-A/B/C/D.png) — D=Stellar Grid 채택본
    ├── gif/            # 14 metaMD trajectory GIF
    ├── fes/
    │   ├── gas/        # <PAIR>_<SIZE>_<COMP>/ — 페어×size×1:1 comp FES PNG
    │   ├── graphene/   # <PAIR>_<SIZE>/
    │   └── Al2O3/      # <PAIR>_<SIZE>/
    └── fes_summary/    # <PAIR>_eoh.png (per-pair 종합 EOH plot)
```

총 자산 ~165 MB (FES PNG 535장 + GIF 14장 + Gemini 원본 6.5MB + hero JPEG 2장 + 테마 시안 PNG 3장). GitHub Pages 1 GB 한도 내 여유.

## 데이터 흐름 (build_data.py)

source(읽음):
- `metadyn/uma_1p2_omat/analysis/output/<PAIR>/summaries/eoh.txt` — 6 페어 (PtPd/AuCu/RuIr/CoNi/CuPd/FeNi)
- `assets/fes/<track>/<PAIR>_<SIZE>[_<COMP>]/fes_*.png` — 사이트에 미리 복사된 FES PNG
- `assets/gif/*.gif` — 미리 복사된 GIF

output(`data.json`):
```
{
  "meta":  {pairs, sizes, supports, n_systems_gas, fes_views, generated_at},
  "eoh":   {<PAIR>: {bulk: {A:..., B:...}, sizes: {<N>: {n_atoms, pure, comps[...]}}}},
  "fes":   {gas|graphene|Al2O3: {<PAIR>: {<SIZE>: {dir, files, comp?}}}},
  "gifs":  [{file, pair, size, substrate, constraint, mlip}, ...]
}
```

각 comp row 필드: `comp, n1, x, E_avg, E_form, E_mix, err`

GIF 메타 필드:
- `substrate ∈ {gas, graphene, Al2O3, unknown}` — 어떤 환경에서 metaMD 돌렸는지
- `constraint ∈ {fix, freetop}` — `fix`=슬랩 전체 고정 (디폴트), `freetop`=상위 layer만 T T T (relax)
- 파일명 규칙: `<pair><size>_<sub>[_freetop]_<mlip>.gif` 예) `ptpd55_al2o3_freetop_uma.gif`. token 없는 옛 파일은 `substrate="gas"` 디폴트, `coni55_sup_uma.gif` 처럼 `sup` 단독 라벨은 `substrate="unknown"` 으로 분류 → 사이트의 supported 페이지에서 제외됨.

## 사이트 페이지 구조 (5-page hash routing)

`<section class="page" id="page-X">` + `.page--active` 토글. `app.js#showPage(name)` 가 hashchange 리스너로 페이지 전환. Plotly 차트는 페이지 visible 된 후 `Plotly.Plots.resize` 로 리사이즈.

1. **`#home`** — hero (NDU 제목 + 3-line lead + 4 stat 카드) + 2 cluster 카드 (Gemini hero 이미지 → 클릭 시 Gas/Supported 페이지로 진입)
2. **`#gas`** — Gas-phase Clusters 페이지: page-head + EOH (메인 차트, hull polished) + FES (gas track 고정) + metaMD (substrate=gas 만)
3. **`#supported`** — Supported Clusters 페이지: page-head + FES (graphene / α-Al₂O₃ 토글) + metaMD (substrate × constraint 두 단계 필터)
4. **`#methods`** — Theory & Methods (3 카드: WT-metaD, FES, EOH 수식)
5. **`#refs`** — References (8개 인용)

## 디자인

### Deep Field 테마 (단일)

(2026-04-30 v2) Stellar Grid (theme-D) 가 너무 "네오틱"하다는 사용자 피드백 (시안 글로우/그리드/네온 톤 과다) → **Universe + Nanocluster** 강화, **Digital 모티프 약화** 방향으로 전환. 새 테마 = "Deep Field".

- 베이스: `var(--bg) #050310` (거의 검정, 약간 자수정 톤). 시안 80px 좌표 그리드 **제거**.
- 네뷸라: 4-stop radial-gradient — 라벤더 좌상(`#A78BFA 0.18`) + 플럼/마젠타 우상(`#E879B8 0.13`) + 앰버 하단(`#FFD56B 0.07`) + 부드러운 블루 우중(`#7AA7FF 0.07`). Hubble Deep Field 같은 톤.
- 별 14개 핀포인트 (`body::before` fixed): 화이트/오프화이트/앰버/소프트블루/라벤더/플럼 — **시안 별 모두 제거**.
- 핵심 색: accent `#A78BFA` lavender (메인), accent2 `#E879B8` plum/magenta, gold `#FFD56B` starlight amber. magenta/teal는 metaMD 뱃지용 보조.
- Hero h1: 라벤더→플럼→앰버 linear-gradient. **drop-shadow 글로우 제거** (네오틱 원흉).
- 통계 카드: 상단 1.5px bar `linear-gradient(90deg, lavender, plum 70%, transparent)` opacity 0.7. **box-shadow / text-shadow 제거**.
- Plotly size palette: `["#7AA7FF","#A78BFA","#C58BE8","#E879B8","#FFD56B"]` (deep-field nebula).

이전 시안 PNG들은 `assets/preview/theme-A/B/C/D.png` 보존 (D=폐기된 Stellar Grid). 라이브 적용 직전 dual-theme 상태는 `backup/2026-04-30/`에 백업.

### Hero 이미지

home의 두 cluster 카드는 `<a class="cluster-card" href="#gas|#supported">` 앵커. 카드 안 `.cluster-img`에 정사각 1:1 비율로 Gemini-rendered JPEG (`assets/hero/cluster-gas.jpg`, `cluster-supported.jpg`). 원본은 `ref/Gemini_Generated_Image_e8bnqse8bnqse8bn.png` (2816×1536, 2-panel A/B). 잘라낸 좌표는 `~/.claude/projects/-home-khshin-NDU/memory/ref_ndu_gemini_hero.md` 에 기록.

이전의 inline SVG cluster 그림 (cyan/violet 19-atom 등)은 제거됨. CSS의 `.cluster-svg` 룰은 dead code.

### Plotly 색

`plotlyLayout()` 이 매 호출 시 `getPalette()` 로 CSS var을 읽어와 paper/plot bg, font, gridcolor를 셋팅. 단일 테마라 런타임 재렌더 트리거는 없음 — `applyTheme()`/토글 제거됨.

### EOH 차트 (gas 페이지)

기본 Plotly 외관이 "Excel틱" 하다고 사용자 피드백 → 다음 폴리시 적용:
- spline-smoothed connector (shape: spline, smoothing 0.6)
- 점 뒤에 큰 halo 트레이스 (size 18, opacity 0.18) → 발광하는 별 점 느낌
- 메인 marker: size 10, line color = `--bg` (plot 배경과 같은 색으로 outlined → 점이 떠보임)
- hull line: dashed → solid + width 2.2 + opacity 0.55
- paper/plot bg 투명 → `.panel` CSS 카드 배경이 비치게
- legend 차트 내부 우상단 floating
- ticks outside, axis title 색은 subtext

`sizeGradient()` 단일 — `["#7AA7FF","#A78BFA","#C58BE8","#E879B8","#FFD56B"]` deep-field nebula.

## 페어/support 추가 워크플로

새 페어 분석이 끝났을 때:

```bash
# 1. EOH txt + FES PNG가 NDU 본체에 생성됐는지 확인
ls /DATA/user_scratch/khshin/NDU/metadyn/uma_1p2_omat/analysis/output/<NEW_PAIR>/summaries/eoh.txt

# 2. PAIRS 리스트에 추가 (build_data.py 상단)
sed -i 's/PAIRS = \["PtPd"/PAIRS = \["NEW", "PtPd"/' /home/khshin/NDU/build_data.py

# 3. FES PNG 복사 (gas 1:1 comp + sup graphene/Al2O3 모두)
#    예시 — claude.md 기존 페어 추가 워크플로 참조

# 4. (선택) 새 metaMD GIF 도 assets/gif/ 에 복사
#    파일명 규칙: <pair><size>_<sub>[_freetop]_<mlip>.gif
#    sub ∈ {gas, graphene, al2o3}, freetop 토큰은 상위 layer만 relax한 변형

# 5. data.json 재생성
cd /home/khshin/NDU && python build_data.py

# 6. push
git add -A && git commit -m "Add <NEW_PAIR> to NDU site" && git push
```

새 support track (예: MgO):

1. `build_data.py`의 `SUPPORTS` 리스트 + `parse_gif_name()` 의 `sub_map` 에 추가
2. CSS `.md-card .badge.<substrate_lc>` 클래스 추가 (스타일링)
3. `index.html` 의 supported 페이지 FES `#fes-sup-track-seg` + MD `#md-sup-sub-seg` 에 버튼 추가
4. 위 4-5단계

## 핵심 결정 누적

- (2026-04-29) **dual theme**: 다크/브라이트 토글. ~~`data-theme` 속성 + CSS var. localStorage로 사용자 선택 유지.~~ → (2026-04-30) **Stellar Grid 단일 테마로 교체 완료** (theme-D). dual theme 변수, `[data-theme="bright"]` 룰, theme-toggle 버튼/JS, `initTheme()`/`applyTheme()`, `localStorage("ndu-theme")` 모두 제거. 이전 상태는 `backup/2026-04-30/` 백업.
- (2026-04-29) **인디고+시안 팔레트**: ClusPot의 orange/navy와 시각적으로 분리. "Digital Universe" 톤.
- (2026-04-29) **FES "all" 옵션 제거**: 페어 필수 선택 → 5개 썸네일만. 페어 늘어도 페이지가 막히지 않도록 design choice.
- (2026-04-29) **metaMD 기본 gas만**: 페이지 로딩 시 14개 다 보이지 않게. 사용자가 탭으로 확장.
- (2026-04-29) **EOH lower hull**: E_form/E_mix 양쪽에 dashed 선. EAH는 정의상 hull=0이라 y=0 reference만.
- (2026-04-29) **FES 갤러리 default thumb**: `fes_3d_fes.png` (실제 free-energy isosurface) 우선. 라이트박스 정렬도 3D FES를 맨 앞.
- (2026-04-29) **Hero SVG perspective**: 두 카드 모두 `rotateX(22deg)`. ~~~~ → (2026-04-30) inline SVG 제거, Gemini 2-panel 이미지로 교체.
- (2026-04-30) **Multi-page 분리 (ClusPot 패턴 차용)**: 단일 스크롤 → 5-page hash routing. Home의 cluster 카드는 페이지 진입점 역할. ClusPot/site 의 `.page` + `showPage()` 패턴 참조 (`ref_cluspot_site.md` 메모리에 기록).
- (2026-04-30) **Hero figure**: Gemini 2-panel render (`ref/Gemini_Generated_Image_*.png`) 잘라서 `assets/hero/cluster-{gas,supported}.jpg`. 잘라낸 좌표는 메모리 기록.
- (2026-04-30) **Home h1**: "Mapping bimetallic cluster phase space" → "Nanocluster Digital Universe" (사이트 정체성을 직접 표시). lead 4줄 → 3줄 + 모호한 "stable mixture" 표현 제거.
- (2026-04-30) **MD substrate × constraint 분리**: `support` 단일 필드 → `substrate ∈ {gas, graphene, Al2O3, unknown}` + `constraint ∈ {fix, freetop}`. supported 페이지에 두 단계 segment 필터.
- (2026-04-30) **EOH 차트 polish**: spline + halo + outlined markers + solid hull + transparent bg. (위 "EOH 차트" 단락 참조)
- (2026-04-30) **Stellar Grid (theme D) 채택**: A/B/C 셋 다 "디지털+우주" 둘 다 강하게 잡지 못해서 A의 우주(성운+별)와 B의 디지털(그리드+글로우)을 융합한 4번째 시안을 새로 제작. 라이브 사이트에 단일 테마로 적용.
- (2026-04-30 v2) **Deep Field 로 전환** (theme D 폐기): D 가 너무 "네오틱" — 시안 그리드 + 시안 별 + h1 글로우 + stat 글로우가 합쳐져 게이밍/사이버펑크 톤. Universe + Nanocluster 강화 / Digital 약화 방향으로 전환. 시안 그리드/글로우 모두 제거, 액센트는 라벤더(`#A78BFA`)/플럼(`#E879B8`)/앰버(`#FFD56B`). 베이스 `#050310`. Hubble Deep Field 톤.
- (2026-04-30) **결정 보류 / TODO**:
  - Chemiscope 연동 — FES + per-frame 구조 + per-frame property 를 한 위젯에 (사용자: "결과분석 시원하게 끝낸 후"). 본체 파이프라인이 frame extraction 끝낸 다음.
  - "가장 안정한 구조" 시각화 — Chemiscope로 흡수 가능. 단기 대안: lowest-`E_form` frame 정적 ASE render PNG.
  - `coni55_sup_uma.gif` substrate 모호 — 사용자 확인 필요.

## 알려진 제한

- FES PNG는 **gas의 1:1 comp + sup의 1:1**만 사이트에 복사됨. 다른 composition의 FES 보려면 `assets/fes/...` 에 직접 추가 필요. 현재 30 (gas) + 30 (graphene) + 25 (Al2O3) = 85 (pair, size) 엔트리.
- AgPd는 `eoh.txt` 가 없어서(1:1 5-size only) 사이트에 안 들어감. 추가하려면 composition sweep 후 EOH 분석 필요 — 본체 CLAUDE.md 참조.
- HTML/JS 캐시 mismatch 가끔 발생 (Cache-Control max-age=600). 사용자에게 Ctrl+Shift+R 안내. **페이지 라우팅 도입 후 특히** — 옛 단일-스크롤 캐시가 살아있으면 hash 변경에 무반응.
- GitHub Pages 첫 빌드는 30초~수 분. 큰 자산 변경 후 즉시 안 보일 수 있음.
- `coni55_sup_uma.gif` 는 substrate=unknown 으로 사이트 supported 페이지에서 제외 중.

## 트러블슈팅

| 증상 | 원인 / 해결 |
|------|---------|
| "data.json failed to load" 메시지 | 실제 fetch 실패 OR `main()` 안에서 throw. F12 Console에서 진짜 에러 확인. 캐시 mismatch면 Ctrl+Shift+R |
| 차트 색이 테마와 안 맞음 | `applyTheme()` re-render 누락. 5개 render 함수 (`renderEah/FesGas/FesSup/MdGas/MdSup`) 호출되는지 확인 |
| 페이지 전환했는데 차트 사이즈 이상 | `showPage()` 의 `Plotly.Plots.resize` 가 실행됐는지. setTimeout 안에 들어있으니 콘솔에서 element id 확인 |
| 카드 클릭해도 페이지 안 바뀜 | `<a href="#gas">` href 가 anchor scroll만 시도하지 않는지. hashchange 리스너 등록되었는지. `STATE.page` 값 확인 |
| FES 썸네일 빈칸 | `assets/fes/<track>/<PAIR>_<SIZE>/` 에 PNG 없음. `build_data.py` 다시 실행해서 인벤토리 갱신 |
| metaMD 카드 substrate=unknown 으로 뜸 | `parse_gif_name()` 정규식이 새 GIF naming convention 못 잡음. `sub_map` 에 새 substrate 토큰 추가 |
| Plotly가 흰 배경으로 떠 있음 | CSS var이 비어 있음. `getPalette()` fallback 값으로 폴백되긴 하지만, `:root` 정의 확인 |

## 외부 의존성

- **Plotly.js 2.35.2** — CDN (`cdn.plot.ly`)
- **Inter / JetBrains Mono** — Google Fonts
- 외 의존 없음. 완전 정적, 어디서든 `python -m http.server` 로 띄움.
- (참고) 테마 프리뷰 PNG 생성에는 `weasyprint==52.5` + `pdftoppm` 사용. 운영 사이트엔 영향 없음.
