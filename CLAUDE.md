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
├── index.html          # 7 섹션 layout (Home/EOH/FES/metaMD/Methods/Refs)
├── styles.css          # dark+bright dual theme via CSS vars
├── app.js              # Plotly + 갤러리 + 테마 토글
├── data.json           # eoh.txt → 파싱한 EOH + FES 인벤토리 + GIF 메타
├── build_data.py       # NDU analysis output → data.json 변환기
└── assets/
    ├── gif/            # 14 metaMD trajectory GIF
    ├── fes/
    │   ├── gas/        # <PAIR>_<SIZE>_<COMP>/ — 페어×size×1:1 comp FES PNG
    │   ├── graphene/   # <PAIR>_<SIZE>/
    │   └── Al2O3/      # <PAIR>_<SIZE>/
    └── fes_summary/    # <PAIR>_eoh.png (per-pair 종합 EOH plot)
```

총 자산 ~158 MB (FES PNG 535장 + GIF 14장). GitHub Pages 1 GB 한도 내 여유.

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
  "gifs":  [{file, pair, size, support, mlip}, ...]
}
```

각 comp row 필드: `comp, n1, x, E_avg, E_form, E_mix, err`

## 사이트 섹션

1. **Home / Overview** — 4 stat 카드 + gas/Al₂O₃ supported SVG 카드 두 장 + 6 페어 quick-jump 타일
2. **Energy on Hull (메인)** — 페어 드롭다운 + (E_form / E_mix / EAH) 토글 + size 다중 토글 + Plotly. lower convex hull 자동 계산 (dashed line, E_form/E_mix 양쪽 표시)
3. **FES Gallery** — pair 필수 선택 → 5 size 썸네일 (전체 30+ 깔리지 않게 의도적). 클릭 → 라이트박스에 6 view (3D FES isosurface 우선)
4. **Well-tempered Metadynamics Trajectories** — 14 GIF 카드, support 필터 (기본 gas)
5. **Theory & Methods** — 3 카드: WT-metaD bias 수식, FES 재구성 수식, E_form/E_mix/EAH 수식 (HTML sub/sup, 모노폰트 박스)
6. **References** — 8개 인용 (PLUMED, well-tempered metaD, UMA/fairchem, SOAP, featomic, ASE, atomistic-cookbook, α-Al₂O₃ Wang 2000)

## 디자인

### 듀얼 테마

`<html data-theme>` 속성으로 전환. CSS variables가 두 테마에서 같은 이름·다른 값.

| 테마 | 분위기 | 핵심 색 |
|------|--------|---------|
| dark (기본) | "deep space" | bg `#0a0a1f`, accent `#22D3EE` cyan, accent2 `#8B5CF6` violet |
| bright | "light sky" | bg `#F1F5FB`, accent `#0891B2` deep cyan, accent2 `#7C3AED` deep violet |

dark에서는 body::before에 starfield용 multi-layer radial-gradient 점들 깔림.

### 토글

- Topbar 우측 ☾/☀ 버튼
- localStorage `ndu-theme` 에 저장
- 토글 시 `applyTheme()` 가 `getPalette()` 재호출 + `renderEah/Fes/Md` 다시 그림 (Plotly 레이아웃이 색을 CSS var에서 읽기 때문)

### Hero SVG

두 카드 (`.cluster-svg svg`)에 CSS `perspective(600px) rotateX(22deg)` — 약 22° 위에서 내려보는 시점. 두 SVG 다 같은 컨테이너 사이즈.

- **Gas card**: 19-atom (1+6+12) ball cluster, cyan/violet alternating
- **Supported card**: 작은 13-atom 클러스터 위에 + α-Al₂O₃ 슬랩 3-row hex-staggered (`sph-alumina` 그라디언트, back row 작고 흐릿하게 → 원근감)

### Plotly 색

`plotlyLayout()` 이 매 호출시 `getPalette()` 로 CSS var을 읽어와 paper/plot bg, font, gridcolor를 셋팅. 테마 토글 → re-render → 차트 색 자동 동기화.

`sizeGradient()` 도 dark/bright 분기 (`["#22D3EE", "#5BAEEC", "#8B5CF6", "#5B21B6", "#1E1B4B"]` 또는 deep-cyan→violet→indigo).

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

# 5. data.json 재생성
cd /home/khshin/NDU && python build_data.py

# 6. push
git add -A && git commit -m "Add <NEW_PAIR> to NDU site" && git push
```

새 support track (예: MgO):

1. `build_data.py`의 `SUPPORTS` 리스트에 추가
2. CSS `.md-card .badge.<support_lc>` 클래스 추가 (스타일링)
3. index.html의 FES `<span class="seg" id="fes-track-seg">`에 버튼 추가
4. 위 4-5단계

## 핵심 결정 누적

- (2026-04-29) **dual theme**: 다크/브라이트 토글. `data-theme` 속성 + CSS var. localStorage로 사용자 선택 유지.
- (2026-04-29) **인디고+시안 팔레트**: ClusPot의 orange/navy와 시각적으로 분리. "Digital Universe" 톤.
- (2026-04-29) **FES "all" 옵션 제거**: 페어 필수 선택 → 5개 썸네일만. 페어 늘어도 페이지가 막히지 않도록 design choice.
- (2026-04-29) **metaMD 기본 gas만**: 페이지 로딩 시 14개 다 보이지 않게. 사용자가 탭으로 확장.
- (2026-04-29) **EOH lower hull**: E_form/E_mix 양쪽에 dashed 선. EAH는 정의상 hull=0이라 y=0 reference만.
- (2026-04-29) **FES 갤러리 default thumb**: `fes_3d_fes.png` (실제 free-energy isosurface) 우선. 라이트박스 정렬도 3D FES를 맨 앞.
- (2026-04-29) **Hero SVG perspective**: 두 카드 모두 `rotateX(22deg)` — 위에서 내려보는 듯한 살짝 대각선 시점. supported 카드는 Al₂O₃ 3-row 원근법.

## 알려진 제한

- FES PNG는 **gas의 1:1 comp + sup의 1:1**만 사이트에 복사됨. 다른 composition의 FES 보려면 `assets/fes/...` 에 직접 추가 필요. 현재 30 (gas) + 30 (graphene) + 25 (Al2O3) = 85 (pair, size) 엔트리.
- AgPd는 `eoh.txt` 가 없어서(1:1 5-size only) 사이트에 안 들어감. 추가하려면 composition sweep 후 EOH 분석 필요 — 본체 CLAUDE.md 참조.
- HTML/JS 캐시 mismatch 가끔 발생 (Cache-Control max-age=600). 사용자에게 Ctrl+Shift+R 안내.
- GitHub Pages 첫 빌드는 30초~수 분. 큰 자산 변경 후 즉시 안 보일 수 있음.

## 트러블슈팅

| 증상 | 원인 / 해결 |
|------|---------|
| "data.json failed to load" 메시지 | 실제 fetch 실패 OR `main()` 안에서 throw. F12 Console에서 진짜 에러 확인. 캐시 mismatch면 Ctrl+Shift+R |
| 차트 색이 테마와 안 맞음 | `applyTheme()` re-render 누락. `renderEah/Fes/Md` 호출되는지 확인 |
| FES 썸네일 빈칸 | `assets/fes/<track>/<PAIR>_<SIZE>/` 에 PNG 없음. `build_data.py` 다시 실행해서 인벤토리 갱신 |
| metaMD 카드 라벨이 raw 파일명 | `parse_gif_name()` 정규식이 새 GIF naming convention 못 잡음. 함수 보강 필요 |
| Plotly가 흰 배경으로 떠 있음 | CSS var이 비어 있음. `getPalette()` fallback 값으로 폴백되긴 하지만, `:root` 정의 확인 |

## 외부 의존성

- **Plotly.js 2.35.2** — CDN (`cdn.plot.ly`)
- **Inter / JetBrains Mono** — Google Fonts
- 외 의존 없음. 완전 정적, 어디서든 `python -m http.server` 로 띄움.
