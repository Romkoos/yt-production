---
episode: 2026-07-ep001
number: 1
repo_url: https://github.com/stablyai/orca
title:
current_phase: assets
phase_status: done
verdict: TBD (решается на FLOW 7)
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
Manual phase — подготовка к записи (порядок обязателен — ГОЛОС строго ПОСЛЕ съёмки):
- [ ] Пре-флайт / чистый лист: пройти REPRO.md SETUP с нуля, свериться с prepared states
- [ ] Музыка: сгенерировать трек в Suno
- [ ] Скринкаст: снять по RECORDING.md (команды/что на экране/WAIT-CUT — всё внутри)
- [ ] Голос: записать озвучку по VOICE.md ⚠️ строго ПОСЛЕ съёмки — вердикт и свидетельства существуют только после дубля (хук наизусть; вердикт — по ветке FLOW 7, оба драфта в VOICE.md)
- [ ] Мемы и звуки: скачать по assets/MEME_LIST.md
- [ ] Монтаж в DaVinci Resolve
- [ ] Сверка таймкодов: записать реальные таймкоды в STATE.md/script.md

## Открытые решения
- **Вердикт решается вживую на FLOW 7 (стена).** report.md честно фиксирует: ядро — мультиагентная оркестрация — в песочнице НЕ проверено, а REPRO's FLOW 7 делает выбор вердикта живым у стены. Поэтому STATE держит `verdict: TBD`, а не ГОДНОТА. Две ветки:
  - **(a) Хост останавливается у стены** (оркестрацию не гонял): озвучка обязана сузить вердикт до доказанного — инженерия и продукт реальны — и прямо сказать, что оркестрация НЕ проверялась. Открытый вопрос: тянет ли это всё ещё на ГОДНОТА (за каркас) или честнее РАНО (ядро непроверено). Слово выбирается по факту дубля.
  - **(b) Хост подключает свои ключи и гоняет живую сессию**: вердикт заработан отснятым — ГОДНОТА, если реально ускоряет; ХАЙП, если оркестратор ради оркестратора.
- **Провизорные ассеты под замену после решения (props, бесплатно):** три превью (`thumb-variants.json`) и `VerdictCard.mp4` сейчас забейкали ГОДНОТА — перерендерить с финальным словом после FLOW 7. `VOICE.md` содержит оба драфта вердикта (a/b) — в понедельник читается тот, что совпал с дублем.

## Artifacts
- report.md: present
- REPRO.md: present (flow ↔ #СКРИНКАСТ cues aligned — Step 3)
- script.md: present
- sandbox/: episodes/2026-07-ep001/sandbox/orca
- RECORDING.md: present (linear shooting run — 7 scenes, clean slate + ⚠️ ОДИН ДУБЛЬ)
- VOICE.md: present (voice session; хук наизусть; вердикт — ДВА драфта a/b под ветку FLOW 7)
- assets/: StarChart.mp4, Intro.mp4, VerdictCard.mp4 (rendered; VerdictCard забейкал провизорный ГОДНОТА — перерендер после FLOW 7); thumb-variants.json + preview/thumb-v1..3.png (3 variants on generative logo bg — real stablyai avatar; verdict провизорно ГОДНОТА); gen-log.json; StarChart.props.json (18 real GraphQL pts); MEME_LIST.md (M1–M2 filled); first-run.png
