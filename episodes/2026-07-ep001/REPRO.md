# REPRO — 2026-07-ep001 (orca)

<!-- Линейный дубль по доктрине: хост записывает ПУТЬ ПОЛЬЗОВАТЕЛЯ живьём, одним прогоном с чистого
     состояния машины. Формат канала — «клонируем трендовый репозиторий и запускаем», поэтому путь
     здесь = путь разработчика (clone → install → dev → онбординг → стена). Всё ниже — то, что
     РЕАЛЬНО произошло в песочнице (см. report.md), а не версия README. Clock (b): шаги семантические,
     без таймкодов.

     Evidence-вставки ВПЛЕТЕНЫ в поток в той точке, где их требует повествование (порядок сцен =
     порядок съёмки): EVIDENCE 3 идёт внутри FLOW 2 (install), EVIDENCE 5 — сразу после FLOW 4 (dev).
     scene-1…scene-7 идут строго по возрастанию в порядке файла — `pnpm prep` иначе не соберётся. -->

**Repo:** https://github.com/stablyai/orca  ·  **Verdict:** ГОДНОТА (черновой lean; риск ХАЙП)  ·  **Sandbox:** `episodes/2026-07-ep001/sandbox/orca`
**Recording time budget:** ~2–3 мин одного линейного дубля (7 сцен, scene-1…7). Единственное длинное ожидание — `pnpm install` в FLOW 2 (~50 с): планировать дубль вокруг него и снять EVIDENCE 3 (пересборку нативы) из этого же прогона, не отдельно. FLOW 7 (стена) — время зависит от решения хоста: остановиться на запросе ключей или подключить свои и продолжить.

---

## Clean slate

<!-- ⚠️ ГЛАВНОЕ: пишем ТОЛЬКО состояние DEV-сборки (`orca-dev`). НЕ трогаем `~/Library/Application
     Support/orca` — это реальная прод-установка Orca хоста, её снос угробит его рабочие данные. -->

```bash
# 1) Снести состояние DEV-сборки Orca (онбординг снова станет «первым запуском»).
#    НЕ УДАЛЯТЬ каталог "orca" (без -dev) — это прод-установка хоста!
rm -rf "$HOME/Library/Application Support/orca-dev"

# 2) Свежий клон в место записи (заменить <REC_DIR> на путь записи; клонировать ОТДЕЛЬНО,
#    НЕ внутрь другого pnpm-workspace — иначе pnpm полезет в родительский node_modules).
rm -rf <REC_DIR>/orca
git clone --depth 1 https://github.com/stablyai/orca <REC_DIR>/orca

# 3) Сбросить утечку окружения: Electron-хосты (Claude Code, VS Code) ставят ELECTRON_RUN_AS_NODE=1.
#    Dev-скрипт Orca сам его удаляет, но записывать лучше из чистого шелла.
unset ELECTRON_RUN_AS_NODE
```

**Env vars to reset:** `ELECTRON_RUN_AS_NODE` (unset). Node: репо требует **Node 24** (`engines`);
у хоста может быть Node 22 — это ОК для записи (см. FLOW 2), решить заранее, показывать ли warning.

---

## User flow

<!-- Numbered linear path a real user walks. Evidence-вставки вплетены сюда же, на своём месте в
     потоке (EVIDENCE-блоки несут свой Anchor-буллет и ⚠️-scope). scene-N идут по возрастанию. -->

<a id="scene-1"></a>
### FLOW 1 — Клонируем трендовый репозиторий  ·  _beat: «что за репо»_
- **Do:** в браузере открыть `https://github.com/stablyai/orca` (19 469 ★, +5 724 за неделю), затем
  в терминале: `git clone --depth 1 https://github.com/stablyai/orca && cd orca`.
- **On screen:** страница репо со счётчиком звёзд; затем клон в терминале, `cd orca`.
- **Wait/Cut:** клон ~10–30 с (8 594 файла) — можно подрезать на монтаже.
- **Reset:** `rm -rf orca` и клонировать заново — идемпотентно.

<a id="scene-2"></a>
### FLOW 2 — `pnpm install`: репа требует Node 24 и компилирует нативу  ·  _beat: «живой тест»_
- **Do:** `pnpm install` (отдельный клон, БЕЗ вложенности в чужой workspace — тогда флаги не нужны).
- **On screen:** сразу жёлтый `WARN Unsupported engine: wanted {"node":"24"} (current v22.22.1)`
  (если у хоста Node < 24), затем установка идёт и в конце `Done in ~50s`. Установка **не падает**.
- **Wait/Cut:** ~50 с. Внутри этого шага — EVIDENCE 3 (пересборка нативы), снять его здесь же.
- **Reset:** `rm -rf node_modules && pnpm install` — идемпотентно.

<a id="scene-3"></a>
### EVIDENCE 3 — postinstall реально пересобирает node-pty под Electron  ·  _beat: «живой тест»_
- **Anchor:** ВНУТРИ FLOW 2 (`pnpm install`), в момент, когда идёт установка — показать, что это не
  веб-обёртка, а нативное приложение, которое честно компилирует бинари.
- **Do:**
  ```bash
  # во время/сразу после pnpm install — показать строки пересборки:
  grep -E '\[rebuild\]|node-pty|cpu-features|gyp info' install.log | head
  ```
- **On screen:** `[rebuild] Patched node-pty build artifacts are missing; rebuilding from source.`,
  и прогон `node-gyp` для `cpu-features` (`gyp info using node@22 | darwin | arm64 … it worked if it
  ends with ok`). Без `gyp ERR`.
- ⚠️ **Чего этот вывод НЕ доказывает:** только то, что это настоящий нативный десктоп-апп, который
  пересобирает node-pty под ABI Electron. Он НЕ доказывает, что оркестрация агентов работает и что
  «100x» реально — агентскую сессию мы не запускали.

<a id="scene-4"></a>
### FLOW 4 — `pnpm dev`: одно окно = пачка процессов + фоновый daemon  ·  _beat: «живой тест»_
- **Do:** `pnpm dev`.
- **On screen:** в логе `electron main process built successfully` → `dev server … localhost:5173`
  → `starting electron app...` → `DevTools listening on ws://127.0.0.1:9382/…`; открывается окно Orca.
- **Wait/Cut:** сборка+старт ~10–15 с. Сразу после появления окна — EVIDENCE 5.
- **Reset:** закрыть окно / `pkill -f "out/electron-dev/.*Orca"`; повторный `pnpm dev` идемпотентен.

<a id="scene-5"></a>
### EVIDENCE 5 — один `pnpm dev` поднимает многопроцессный апп + фоновый daemon  ·  _beat: «живой тест»_
- **Anchor:** сразу после FLOW 4 (окно Orca открылось) — доказать масштаб: одно окно = дерево
  процессов и демон в фоне.
- **Do:**
  ```bash
  pgrep -fl "Orca: main|electron-vite.js dev|daemon-entry.js" | head
  ls "$HOME/Library/Application Support/orca-dev"   # daemon/ cli/ codex-runtime-home/ agent-hooks/
  ```
- **On screen:** main-процесс Orca + GPU/renderer/network-хелперы + отдельный процесс
  `daemon-entry.js` со своим `--socket … daemon-v22.sock`; каталог состояния с папками `daemon/`,
  `cli/`, `codex-runtime-home/`, `agent-hooks/`.
- ⚠️ **Чего этот вывод НЕ доказывает:** только то, что запущен реальный многопроцессный десктоп-апп
  с фоновым демоном под оркестрацию. Он НЕ доказывает, что хоть один агент реально оркеструется —
  ни одной агентской сессии в кадре не поднято.

<a id="scene-6"></a>
### FLOW 6 — Первый запуск: вылизанный онбординг и тикающий лимит  ·  _beat: «живой тест»_
- **Do:** ничего не нажимать — просто показать стартовый экран Orca.
- **On screen:** тёмная тема; сайдбар `Onboarding checklist / Tasks / Automations / Orca Mobile`;
  по центру логотип **ORCA**, `No workspaces found`, `Add a project to get started`, кнопки
  **Add Project / Create workspace**; внизу счётчики **«85% used 5h · 63% used wk»**.
  (Референс-кадр: `assets/first-run.png`.)
- **Wait/Cut:** статичный экран — снять пару секунд «дыхания».
- **Reset:** требует Clean slate (иначе онбординг не «первый») — см. Environment caveats.

<a id="scene-7"></a>
### FLOW 7 — Стена: дальше без API-ключей и агентских CLI не пройти  ·  _beat: «где README врёт / вердикт»_
- **Do:** нажать **Add Project** (или Create workspace) и дойти до точки, где Orca просит агентов
  (Codex/Claude Code/Pi) и/или доступ к подписке — т.е. до места, где нужны реальные ключи хоста.
- **On screen:** момент, где продукт упирается в необходимость подключить агента/ключи, чтобы начать
  оркестрацию. **Хост решает живьём:** либо остановиться здесь (честная граница ревью), либо, если
  готов, подключить СВОИ ключи и показать реальную мультиагентную сессию — этого песочница НЕ делала.
- **Wait/Cut:** зависит от решения хоста; это кульминация для вердикта.
- **Reset:** после подключения ключей вернуть Clean slate, чтобы онбординг снова был чистым.

---

## Environment caveats

<!-- Одноразовые/машинно-зависимые моменты. RECORDING.md выносит их в ⚠️ ОДИН ДУБЛЬ. -->

- **Чистый онбординг (FLOW 6) — один дубль по состоянию.** Экран `No workspaces found` /
  `Add a project to get started` появляется только если перед записью снесён `~/Library/Application
  Support/orca-dev`. На машине, которая уже гоняла dev-сборку, first-run будет другим. Сносить только
  `orca-dev`, НЕ `orca` (прод-данные хоста).
- **Счётчик лимита «85% used 5h» — проверить живьём.** На абсолютно чистой машине он может быть по
  нулям; замеченный расход мог подтянуться из уже установленной прод-Orca (`~/Library/Application
  Support/orca` на машине существует). Если хочется показать «лимит уже капает» — убедиться, что это
  не артефакт прод-установки; иначе снять как есть и не утверждать в озвучке лишнего.
- **`WARN Unsupported engine: wanted Node 24` (FLOW 2) воспроизводится только на Node < 24.** Если
  хост пишет на Node 24+, warning не появится — решить заранее, нужен ли этот кадр-хук.
- **НЕ воспроизводить в кадре ошибку `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR` / трюк с
  `--ignore-workspace`.** Это артефакт вложенности песочницы в наш `yt-production` workspace, а не
  поведение Orca. При отдельном клоне (FLOW 1) его не будет; ставить обычным `pnpm install`.
  Оговорка честности: обычный standalone-`pnpm install` без `--ignore-workspace` в песочнице НЕ
  проверялся (был вынужден флаг из-за вложенности) — хост подтверждает чистый прогон вживую на FLOW 2.

---

## Prepared states  <!-- OPTIONAL — off-camera time savings ONLY -->

- **Кэш Electron / node_modules** — off-camera можно заранее прогнать `pnpm install` в отдельном
  клоне, чтобы на записи не ждать ~50 с скачивания Electron и компиляции. НО: EVIDENCE 3
  (пересборка нативы) — это видео-момент; если install уносится off-camera, строки `[rebuild]`/
  `node-gyp` всё равно нужно показать из сохранённого `install.log`. Проще оставить install в кадре.
