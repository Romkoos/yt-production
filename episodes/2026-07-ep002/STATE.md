---
episode: 2026-07-ep002
number: 2
repo_url: https://github.com/Zackriya-Solutions/meetily
title:
current_phase: assets
phase_status: done
verdict: ХАЙП
youtube_video_id:
updated: 2026-07-14
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
- [ ] Pre-flight (СЕГОДНЯ, до записи): пройти SETUP из REPRO.md с нуля, свериться с
  prepared states; скачать модели meetily через онбординг (сотни МБ — единственное
  длинное ожидание); подготовить карантинный DMG для сцены #2 (браузером или рецептом
  из Failure recipes)
- [ ] Музыка: сгенерировать трек в Suno (в любой день до монтажа)
- [ ] Скринкаст (среда): снять по RECORDING.md — 9 сцен, включая живой замер сцены #6
- [ ] Голос (понедельник): записать по VOICE.md (хук и вердикт — наизусть).
  ⚠️ СТРОГО ПОСЛЕ скринкаста: блок про «4x faster» говорит «я померил» — замер
  происходит в сцене #6 на съёмке
- [ ] Мемы и звуки: скачать по assets/MEME_LIST.md
- [ ] Монтаж в DaVinci Resolve
- [ ] Сверка таймкодов: записать реальные таймкоды в STATE.md/script.md

## Открытые решения
- **Превью: вариант НЕ выбран — и это намеренно.** Все 3 уходят в YouTube Test & Compare,
  победителя определяет CTR, а не вкус. Не сводить к одному до публикации. Хост склоняется
  к A визуально, но сомневается в хуке — именно это и проверяем.
  Композиция у всех трёх одинаковая (её задаёт сгенерированная сцена); единственная
  переменная — **текст хука**:
  - A — «100% ЛОКАЛЬНО / ПОЧТИ» — обрушение обещания приватности
  - B — «7 440 ЗВЁЗД / ЗА НЕДЕЛЮ / 0 КОММИТОВ» — звёздная аномалия (цифры акцентом)
  - C — «ОБЕЩАЛИ / ПРИВАТНОСТЬ / POSTHOG» — телеметрия внутри
  В `/retro`: записать победителя и его CTR — это первая точка данных о том, какой тип хука
  работает на канале (обещание-против-реальности / аномалия цифр / улика).
- **Заголовок ролика не финализирован.** Он один на все три превью, поэтому не должен
  дублировать ни один из хуков — иначе тайтл и превью потратят два места на один факт.
  Хук B («7 440 звёзд… 0 коммитов») закрывает для заголовка тему звёзд и коммитов, A и C —
  тему приватности. Заголовку остаётся то, чего нет ни в одном превью: что это за продукт
  и несуществующая диаризация.
- **Порядок manual-фазы жёсткий: скринкаст → голос.** VOICE.md утверждает «я померил»
  (Parakeet vs Whisper) — замер существует только после сцены #6. Голос, записанный до
  съёмки, произнёс бы неизмеренный факт.

## Artifacts
- report.md: present
- REPRO.md: present
- script.md: present
- sandbox/: episodes/2026-07-ep002/sandbox/meetily (+ `dist/` — DMG, `run/` — распакованный .app)
- assets/: StarChart.mp4, Intro.mp4, VerdictCard.mp4, thumb-variants.json (3 варианта),
  preview/ (thumb-v1..v3 + 120px, index.html), MEME_LIST.md, StarChart.props.json
  (real data — tier=graphql, 20 pts) · RECORDING.md (9 сцен) + VOICE.md (17 блоков) в корне эпизода
- publish/: present (pre-pack — titles, description, tags, shorts-pitches; captions ждут /cut-shorts)
