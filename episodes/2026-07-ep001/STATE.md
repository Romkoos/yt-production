---
episode: 2026-07-ep001
number: 1
repo_url: https://github.com/stablyai/orca
title:
current_phase: assets
phase_status: done
verdict: ГОДНОТА
youtube_video_id:
updated: 2026-07-15
---

## Phase checklist
<!-- markers: [ ] pending · [~] in progress · [x] done · [-] skipped (add a reason, e.g. "scout (skipped — direct review)") -->
- [-] scout (skipped — direct review)
- [x] review
- [x] script
- [x] assets
- [ ] manual
- [ ] publish
- [ ] retro

## Next action
Manual phase — подготовка к записи:
- [ ] Музыка: сгенерировать трек в Suno
- [ ] Голос: записать озвучку по VOICE.md (хук и вердикт — наизусть)
- [ ] Скринкаст: снять по RECORDING.md (команды/что на экране/WAIT-CUT — всё внутри)
- [ ] Проверка REPRO.md: пройти SETUP с нуля, свериться с prepared states
- [ ] Мемы и звуки: скачать по assets/MEME_LIST.md
- [ ] Монтаж в DaVinci Resolve
- [ ] Сверка таймкодов: записать реальные таймкоды в STATE.md/script.md

## Artifacts
- report.md: present
- REPRO.md: present (flow ↔ #СКРИНКАСТ cues aligned — Step 3)
- script.md: present
- sandbox/: episodes/2026-07-ep001/sandbox/orca
- RECORDING.md: present (linear shooting run — 7 scenes, clean slate + ⚠️ ОДИН ДУБЛЬ)
- VOICE.md: present (voice session — 11 blocks; хук + вердикт naizust)
- assets/: StarChart.mp4, Intro.mp4, VerdictCard.mp4 (rendered); thumb-variants.json + preview/thumb-v1..3.png (3 variants on generative logo bg — real stablyai avatar baked in via pnpm scene); gen-log.json; StarChart.props.json (18 real GraphQL pts); MEME_LIST.md (M1–M2 filled); first-run.png
