# REPRO — 2026-07-ep002 (meetily)

**Repo:** https://github.com/Zackriya-Solutions/meetily  ·  **Verdict:** ХАЙП (черновой)  ·  **Sandbox:** `episodes/2026-07-ep002/sandbox/meetily`
**Recording time budget:** ~45–60 мин на 9 сцен, **если модели скачаны заранее**. Единственное длинное ожидание — сцена 6 (замер скорости): загрузка моделей Parakeet + summary это несколько сотен МБ, прогони онбординг ДО записи. Сцены 4 и 5 снимаются **одним запуском приложения** — не закрывай его между дублями. Сцены 3, 7, 8, 9 — терминальная статика, идут быстро подряд. Сцену 2 планируй первой: она требует «свежескачанного браузером» DMG с флагом карантина.

---

## Prepared states

- **READY-APP** — `episodes/2026-07-ep002/sandbox/run/meetily.app` — приложение уже
  распаковано из DMG и лежит в песочнице; запускается напрямую, в `/Applications` тащить
  не нужно. Экономит монтирование образа на каждом дубле.
  Пересобрать: `hdiutil attach episodes/2026-07-ep002/sandbox/dist/meetily_0.4.0_aarch64.dmg -nobrowse -readonly && cp -R /Volumes/meetily/meetily.app episodes/2026-07-ep002/sandbox/run/ && hdiutil detach /Volumes/meetily`

- **READY-DMG** — `episodes/2026-07-ep002/sandbox/dist/meetily_0.4.0_aarch64.dmg` — образ
  скачан (47 МБ), sha256 `a38eab454a8dd3b3e0956f24915564e5bc08222dcf007342446f916f51caa728`.
  ⚠️ Скачан через `gh`, поэтому **флага карантина на нём НЕТ**. Для сцены про Gatekeeper его
  надо выставить руками (см. Failure recipes) — иначе `spctl` покажет не то, что увидит
  реальный пользователь.

- **CLEAN-STATE (нужен для сцены «первый запуск»)** — приложение уже отработало первый старт
  на этой машине, поэтому онбординг больше не покажется. Чтобы снять первый запуск заново:
  ```bash
  rm -rf "$HOME/Library/Application Support/com.meetily.ai"
  ```
  ⚠️ Это сотрёт локальную базу встреч meetily. На этой машине там ничего ценного нет
  (приложение поставлено только под разбор), но проверь перед выполнением.

- **МОДЕЛИ НЕ СКАЧАНЫ** — `onboarding-status.json` показывает `parakeet: not_downloaded`,
  `summary: not_downloaded`. Онбординг качает их через GUI. **Сделай это ДО начала записи**
  (несколько сотен МБ) — иначе дубль встанет колом на прогресс-баре.

---

## SETUP — zero to running (copy-paste)

Переменные окружения: **не нужны**.
Docker, Rust, cmake — **не нужны**. README предлагает готовый `.dmg`, его и берём; сборка из
исходников потребовала бы Rust + cmake и ничего к разбору не добавляет.

```bash
cd episodes/2026-07-ep002/sandbox

# 1. Скачать релиз — ~10s, success: файл 47 МБ на диске
gh release download v0.4.0 --repo Zackriya-Solutions/meetily \
  --pattern "meetily_0.4.0_aarch64.dmg" --dir dist --clobber

# 2. Смонтировать и достать .app — ~3s, success: "/Volumes/meetily"
hdiutil attach dist/meetily_0.4.0_aarch64.dmg -nobrowse -readonly
mkdir -p run && cp -R /Volumes/meetily/meetily.app run/
hdiutil detach /Volumes/meetily

# 3. Запустить — ~2s до окна, success: в логе "Application setup complete"
#    и "Hardware acceleration support: enabled"
./run/meetily.app/Contents/MacOS/meetily
```

Приложение попросит доступ к **микрофону** и к **уведомлениям**. При первом запуске откроется
онбординг с загрузкой моделей — прогони его заранее (см. Prepared states).

---

## Scenes  <!-- one block per [СКРИНКАСТ #N] cue; the anchor's N IS the script's N -->

⚠️ **Сцену 2 снимай ПЕРВОЙ по времени, если качаешь DMG браузером** — только браузер ставит
флаг карантина. Если уже скачал через `gh`, флаг ставится руками (см. Failure recipes).

<a id="scene-1"></a>
### SCENE 1 — витрина репы  ·  _beat: Хук_
- **Do:** открыть `https://github.com/Zackriya-Solutions/meetily`, навести на строку описания
  под названием репы; отдельным кадром — счётчик звёзд.
- **On screen:** строка «Privacy first, AI meeting assistant with 4x faster transcription,
  speaker diarization, and summarization… 100% local processing» + «24k stars».
- **Wait/Cut:** — (статичная страница; можно снять зумом, три обещания подсветить в Resolve)
- **Reset:** — (идемпотентно)

<a id="scene-2"></a>
### SCENE 2 — Gatekeeper блокирует установку  ·  _beat: Живой тест_
- **Do:** скачать `meetily_0.4.0_aarch64.dmg` **браузером** со страницы
  [Releases](https://github.com/Zackriya-Solutions/meetily/releases/tag/v0.4.0) → двойной клик
  по файлу в Finder. Рядом на втором мониторе/окне держать README открытым на шагах установки.
- **On screen:** диалог macOS о том, что образ не может быть проверен на вредоносное ПО, —
  и рядом README со своими четырьмя шагами, второй из которых «Open the downloaded .dmg».
- **Wait/Cut:** — (срабатывает мгновенно)
- **Reset:** диалог просто закрыть; чтобы повторить — файл должен сохранить флаг карантина
  (не открывай его «всё равно», иначе macOS снимет флаг и второй дубль не сработает).
- **Failure recipe:** см. «DMG не нотаризован → Gatekeeper блокирует установку» ниже.

<a id="scene-3"></a>
### SCENE 3 — приложение нотаризовано, коробка нет  ·  _beat: Живой тест_
- **Do:**
  ```bash
  cd episodes/2026-07-ep002/sandbox
  hdiutil attach dist/meetily_0.4.0_aarch64.dmg -nobrowse -readonly
  spctl -a -vvv /Volumes/meetily/meetily.app          # приложение
  spctl -a -vvv -t open --context context:primary-signature dist/quarantined.dmg   # коробка
  ```
- **On screen:** два вывода подряд в одном кадре — `accepted / source=Notarized Developer ID`
  и `rejected / source=Unnotarized Developer ID`, у обоих одна и та же
  `origin=Developer ID Application: ZACKRIYA SOLUTIONS (554AZZ38TB)`.
- **Wait/Cut:** — (мгновенно). **Важно:** оба вывода должны попасть в один кадр — в этом вся соль.
- **Reset:** — (идемпотентно). `quarantined.dmg` создаётся рецептом из Failure recipes.

<a id="scene-4"></a>
### SCENE 4 — запуск с первого раза  ·  _beat: Живой тест (хвалим)_
- **Do:**
  ```bash
  cd episodes/2026-07-ep002/sandbox
  ./run/meetily.app/Contents/MacOS/meetily
  ```
- **On screen:** в терминале лог — `macOS detected - attempting to enable Metal GPU
  acceleration`, `Hardware acceleration support: enabled`, `Application setup complete`;
  следом открывается окно приложения. Ошибок в логе нет.
- **Wait/Cut:** ~2 сек до окна. Приложение спросит доступ к **микрофону** и **уведомлениям** —
  выдай их до записи, иначе диалоги попадут в кадр.
- **Reset:** — (идемпотентно). Чтобы снять **первый** запуск с онбордингом:
  `rm -rf "$HOME/Library/Application Support/com.meetily.ai"` — но тогда снова придётся качать
  модели, см. Prepared states.

<a id="scene-5"></a>
### SCENE 5 — ноль исходящих соединений  ·  _beat: Живой тест (хвалим)_
- **Do:** при запущенном приложении (сцена 4), во втором окне терминала:
  ```bash
  lsof -i -a -p $(pgrep -x meetily) -nP
  ```
- **On screen:** пустой вывод — ни одного сокета.
- **Wait/Cut:** ⚠️ Проверено только на **старте**, в окне ~20 сек после запуска, до транскрипции
  и до суммаризации. **Не выдавай это за «ноль сокетов всегда»** — снимай ровно то окно, что
  проверено. Если выбрать облачного провайдера для саммари, соединения появятся, и это честно.
- **Reset:** — (идемпотентно)

<a id="scene-6"></a>
### SCENE 6 — замер «4x faster»  ·  _beat: Живой тест_
- **Do:** в приложении: импортировать аудиофайл (Import) → транскрибировать через **Parakeet**,
  засечь время → повторно транскрибировать тот же файл через **Whisper** (re-transcribe со
  сменой модели), засечь время. Секундомер держать в кадре.
- **On screen:** два времени рядом.
- **Wait/Cut:** ⚠️ **Модели скачай ДО записи** (Prepared states) — иначе дубль встанет на
  прогресс-баре загрузки. Длительность зависит от файла: бери короткий (2–3 мин аудио).
- **Reset:** re-transcribe можно гонять повторно на том же файле.
- ⚠️ **Что этот замер НЕ доказывает:** он даёт отношение Parakeet↔Whisper **внутри самого
  meetily**. Заявленное «4x» ни к чему не привязано — базы сравнения в репозитории нет. Если
  из замера не следует, к чему относится «4x», так и говори: клейм непроверяем, потому что
  автор не указал базу. **Свою базу за автора не подставляй.**

<a id="scene-7"></a>
### SCENE 7 — PostHog внутри «no data ever leaves your computer»  ·  _beat: Где README врёт_
- **Do:**
  ```bash
  cd episodes/2026-07-ep002/sandbox
  strings -a run/meetily.app/Contents/MacOS/meetily | grep -o "https://us.i.posthog.com[a-z/0-9]*" | sort -u
  ```
  Рядом держать открытым README на строке 97.
- **On screen:** `https://us.i.posthog.com/i/v0/e/` — и рядом строка README «**Local First:**
  All processing is done on your machine. No data ever leaves your computer.»
- **Wait/Cut:** — (мгновенно)
- **Reset:** — (идемпотентно)

<a id="scene-8"></a>
### SCENE 8 — гит показывает, когда аналитику выключили  ·  _beat: Где README врёт_
- **Do:**
  ```bash
  cd episodes/2026-07-ep002/sandbox/meetily
  git log --all -S "analyticsDefaultOffMigration" --format='%ad · %s' --date=short
  ```
- **On screen:** `2026-05-06 · fix: make analytics opt-in by default [skip ci]`
- **Wait/Cut:** — (мгновенно). Для контекста можно доснять
  `git log --all -i --grep="analytic\|posthog" --format='%ad · %s' --date=short | head` —
  видно инструментовку PostHog в феврале и фикс в мае.
- **Reset:** — (идемпотентно). Требует полной истории: если клон свежий и shallow —
  сначала `git fetch --unshallow`.

<a id="scene-9"></a>
### SCENE 9 — диаризации не существует  ·  _beat: Где README врёт_
- **Do:** в одном кадре: строка описания репы на GitHub со словами «speaker diarization» —
  и README на строке 47 / 223. Поверх — календарь с текущей датой. Добить:
  ```bash
  cd episodes/2026-07-ep002/sandbox/meetily && git log -1 --format='%ad · %s' --date=short
  ```
- **On screen:** «Speaker diarization is **planned** for **PRO** in **mid-June**» против
  рекламной строки — и `2026-06-05` как дата последнего коммита.
- **Wait/Cut:** — (статика; композиция собирается в Resolve)
- **Reset:** — (идемпотентно)

---

## Failure recipes

- **DMG не нотаризован → Gatekeeper блокирует установку** — детерминированно, воспроизводится
  на 100%. Флаг карантина надо выставить самому, потому что `gh` его не ставит (а браузер —
  ставит):

  ```bash
  cd episodes/2026-07-ep002/sandbox/dist
  cp meetily_0.4.0_aarch64.dmg quarantined.dmg
  xattr -w com.apple.quarantine "0083;$(printf %x $(date +%s));Safari;" quarantined.dmg
  spctl -a -vvv -t open --context context:primary-signature quarantined.dmg
  ```

  Точный вывод на экране:
  ```
  quarantined.dmg: rejected
  source=Unnotarized Developer ID
  origin=Developer ID Application: ZACKRIYA SOLUTIONS (554AZZ38TB)
  ```

  Парный контраст (снимать в том же кадре — в этом вся соль):
  ```bash
  spctl -a -vvv /Volumes/meetily/meetily.app
  # → accepted / source=Notarized Developer ID
  ```
  Приложение нотаризовано, коробка — нет.

- **PostHog в «no data ever leaves your computer»** — детерминированно:
  ```bash
  strings -a run/meetily.app/Contents/MacOS/meetily | grep -o "https://us.i.posthog.com[a-z/0-9]*" | sort -u
  # → https://us.i.posthog.com/i/v0/e/
  ```

- **Аналитика была включена по умолчанию до мая** — детерминированно:
  ```bash
  cd episodes/2026-07-ep002/sandbox/meetily
  git log --all -S "analyticsDefaultOffMigration" --format='%ad · %s' --date=short
  # → 2026-05-06 · fix: make analytics opt-in by default [skip ci]
  ```

- **Ноль исходящих соединений (сцена, где мы хвалим)** — воспроизводится, но требует
  аккуратности: запусти приложение, возьми PID, и рядом в кадре держи
  ```bash
  lsof -i -a -p <PID> -nP
  # → пусто
  ```
  ⚠️ Проверено только на **старте** (~20 сек, до транскрипции и до суммаризации). Во время
  суммаризации через облачного провайдера соединения, разумеется, появятся — это не
  опровержение, это другая конфигурация. Не выдавай «ноль сокетов на старте» за «ноль сокетов
  всегда»: снимать надо ровно то окно, что проверено.

- **⚠️ «4x faster» — НЕ ИЗМЕРЕНО в песочнице.** Движок вкомпилирован в Tauri-бинарь, CLI нет,
  headless не гоняется. **Замер делается руками на записи**, иначе цифру называть нельзя:
  1. Прогони онбординг, скачай модель Parakeet.
  2. Возьми один и тот же аудиофайл (импорт файла: README:146 — «Import existing audio files»).
  3. Транскрибируй через Parakeet, засеки время. Затем через Whisper (переключение модели —
     та же функция re-transcribe), засеки время.
  4. **Это даст отношение Parakeet↔Whisper внутри самого meetily, а НЕ «4x относительно
     чего-то».** Что именно значит «4x» в их тайтле — в репозитории не сказано, базы сравнения
     нет. Если после замера непонятно, к чему относится «4x», — так и говори в ролике: клейм
     непроверяем, потому что автор не указал базу. Не подставляй свою базу за него.
