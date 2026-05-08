#!/usr/bin/env node
/**
 * Upstage Brand Assets — Figma Sync Script
 *
 * 사용법:
 *   FIGMA_TOKEN=xxx node scripts/sync.js
 *
 * 환경변수:
 *   FIGMA_TOKEN  — Figma Personal Access Token (필수)
 *   FIGMA_FILE   — Figma File Key (기본값: V33vhvlkqMk79sixQJYU6X)
 *
 * 실행 결과:
 *   assets/ 폴더에 SVG 파일 저장
 *   brand-assets.json 자동 생성
 */

const fs   = require('fs');
const path = require('path');

const TOKEN    = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE || 'V33vhvlkqMk79sixQJYU6X';
const BASE_URL = 'https://api.figma.com/v1';
const REPO_RAW = 'https://raw.githubusercontent.com/upstage-comm/brand-assets/main';

if (!TOKEN) {
  console.error('❌  FIGMA_TOKEN 환경변수가 없습니다.');
  process.exit(1);
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

async function figmaGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-Figma-Token': TOKEN }
  });
  if (!res.ok) throw new Error(`Figma API error: ${res.status} ${await res.text()}`);
  return res.json();
}

function parseName(name) {
  const lo = name.toLowerCase();
  let type = '';
  let color = 'color';

  // 타입 감지
  if      (lo.includes('lockup'))                               type = 'lockup';
  else if (lo.includes('symbol'))                               type = 'symbol';
  else if (lo.includes('wordmark') || lo.includes('wordtype'))  type = 'wordmark';
  else if (lo.includes('icon'))                                 type = 'icon';
  else if (lo.includes('illustration'))                         type = 'illustration';
  else { const p = name.split('_'); type = (p[1] || p[0]).toLowerCase(); }

  // 색상 감지
  if      (lo.endsWith('_color') || lo.includes('_color_'))    color = 'color';
  else if (lo.endsWith('_black') || lo.includes('_black_'))    color = 'black';
  else if (lo.endsWith('_white') || lo.includes('_white_'))    color = 'white';
  else if (lo.endsWith('_purple')|| lo.includes('_purple_'))   color = 'purple';

  return { type, color };
}

function slugify(str) {
  return str.toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/[^a-z0-9/_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function pageToFolder(pageName) {
  const lo = pageName.toLowerCase();
  if (lo.startsWith('brand'))   return 'brand';
  if (lo.startsWith('product')) return 'product';
  if (lo.startsWith('icon'))    return 'icons';
  return slugify(pageName.split('/')[0].trim());
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍  Figma 파일 구조 읽는 중...');
  const file = await figmaGet(`/files/${FILE_KEY}`);

  // 1) 모든 에셋 수집
  const nodes = [];
  for (const page of file.document?.children || []) {
    for (const node of page.children || []) {
      if (['FRAME', 'COMPONENT', 'COMPONENT_SET', 'GROUP'].includes(node.type)) {
        const { type, color } = parseName(node.name);
        const folder = pageToFolder(page.name);
        const fileName = `${slugify(node.name)}.svg`;
        nodes.push({
          id:        node.id,
          name:      node.name,
          page:      page.name,
          type,
          color,
          folder,
          fileName,
          filePath:  `assets/${folder}/${fileName}`,
        });
      }
    }
  }
  console.log(`✅  에셋 ${nodes.length}개 발견`);

  // 2) SVG export URL 일괄 요청 (배치 처리)
  const BATCH = 100;
  const svgMap = {};

  for (let i = 0; i < nodes.length; i += BATCH) {
    const batch = nodes.slice(i, i + BATCH);
    const ids   = batch.map(n => n.id).join(',');
    console.log(`📦  SVG export 요청 중 (${i + 1}~${Math.min(i + BATCH, nodes.length)}/${nodes.length})...`);

    const result = await figmaGet(`/images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&format=svg&svg_include_id=false`);
    if (result.images) Object.assign(svgMap, result.images);

    // API rate limit 방지
    await new Promise(r => setTimeout(r, 500));
  }

  // 3) SVG 파일 다운로드 & 저장
  const catalog = [];

  for (const node of nodes) {
    const svgUrl = svgMap[node.id];
    if (!svgUrl) {
      console.warn(`⚠️   SVG URL 없음: ${node.name}`);
      continue;
    }

    const dir = path.join('assets', node.folder);
    ensureDir(dir);

    try {
      const svgRes = await fetch(svgUrl);
      const svgContent = await svgRes.text();
      const localPath = path.join(dir, node.fileName);
      fs.writeFileSync(localPath, svgContent, 'utf8');

      catalog.push({
        id:        `${node.folder}/${node.fileName.replace('.svg', '')}`,
        name:      node.name,
        page:      node.page,
        type:      node.type,
        color:     node.color,
        usage:     node.color === 'white' ? 'dark background' : node.color === 'black' ? 'light background' : 'any background',
        file:      node.filePath,
        url:       `${REPO_RAW}/${node.filePath}`,
        figma_node_id: node.id,
      });

      console.log(`  ✔  ${node.filePath}`);
    } catch (e) {
      console.warn(`⚠️   다운로드 실패: ${node.name} — ${e.message}`);
    }

    // 요청 간 딜레이
    await new Promise(r => setTimeout(r, 100));
  }

  // 4) brand-assets.json 생성
  const output = {
    version:     new Date().toISOString().split('T')[0],
    figma_file:  FILE_KEY,
    repo_raw:    REPO_RAW,
    total:       catalog.length,
    assets:      catalog,
  };

  fs.writeFileSync('brand-assets.json', JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n🎉  완료! brand-assets.json에 ${catalog.length}개 에셋 기록됨`);
}

main().catch(err => {
  console.error('❌  오류:', err.message);
  process.exit(1);
});
