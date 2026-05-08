# Upstage Brand Assets

Figma에서 자동으로 동기화되는 Upstage 브랜드 에셋 저장소.

## 에이전트 사용법

`brand-assets.json`을 읽어 에셋을 탐색하고, `url` 필드로 SVG를 가져옵니다.

```js
// 예시: 어두운 배경에 맞는 Console 로고 찾기
const { assets } = require('./brand-assets.json');
const logo = assets.find(a => a.name.includes('console') && a.color === 'white');
// logo.url → raw.githubusercontent.com/...console_white.svg
```

## 폴더 구조

```
assets/
├── brand/    — Upstage 메인 로고, 서브페이지 로고
├── product/  — Solar LLM, Document Parse 등 제품 로고
└── icons/    — 아이콘
brand-assets.json   — 에이전트 인덱스
scripts/sync.js     — Figma 동기화 스크립트
```

## brand-assets.json 필드

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자 (예: `brand/logo_main_black`) |
| `name` | Figma 원본 이름 |
| `page` | Figma 페이지명 (카테고리) |
| `type` | lockup / symbol / wordmark / icon / illustration |
| `color` | black / white / purple / color |
| `usage` | 권장 사용 배경 |
| `url` | raw GitHub URL (SVG 직접 접근) |
| `figma_node_id` | Figma 노드 ID |

## 수동 동기화

```bash
FIGMA_TOKEN=your_token node scripts/sync.js
```

## 자동 동기화

GitHub Actions이 매주 월요일 오전 9시(KST)에 자동 실행.
Figma 업데이트가 있으면 자동으로 커밋됩니다.

### 초기 설정

1. GitHub repo Settings → Secrets → `FIGMA_TOKEN` 추가
2. (선택) `FIGMA_FILE` — 기본값: `V33vhvlkqMk79sixQJYU6X`
