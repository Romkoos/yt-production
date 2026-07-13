# REPRO — 2026-07-ep001 (facebook/astryx)

<!-- Протокол воспроизведения — исполняемый путь, по которому host снимает выпуск, НЕ разбираясь
     во внутренностях репозитория. Приёмочный тест: если для шага нужно решение, которого здесь
     нет (какой Node? какой флаг? собралось ли?), протокол неполный. Всё ниже — то, что реально
     произошло в песочнице (см. report.md), а не версия из README. Clock (b): шаги сцен —
     семантические инструкции для съёмки, без таймкодов. -->

**Repo:** https://github.com/facebook/astryx  ·  **Вердикт:** ГОДНОТА  ·  **Sandbox:** `episodes/2026-07-ep001/sandbox/astryx`
**Recording time budget:** ≈ 35 мин активной записи (один прогон `pnpm test` ~70 с переиспользуется для сцен 8 и 9).

---

## Prepared states

- **READY** — `episodes/2026-07-ep001/sandbox/astryx` — зависимости уже установлены
  (`pnpm install --ignore-scripts`, ~1.5 ГБ `node_modules`) и все пакеты **собраны** (`packages/*/dist`
  на месте, `packages/core/dist/astryx.css` присутствует). Обслуживает сцены **5, 6, 7 (успешная
  половина), 8, 9** — снимаются сразу, без ожидания install/build.
- **Для сцены 4 (сам install)** нужна чистая установка. Чтобы НЕ трогать READY, сними install во
  втором клоне:
  ```bash
  git clone --depth 1 https://github.com/facebook/astryx episodes/2026-07-ep001/sandbox/astryx-clean
  cd episodes/2026-07-ep001/sandbox/astryx-clean   # здесь и снимаем сцену 4
  ```
  Либо переиспользуй READY: `rm -rf node_modules packages/*/node_modules apps/*/node_modules internal/*/node_modules`
  и повтори install — это ~12 с, так что READY восстанавливается дёшево (`dist/` при этом остаётся).

---

## SETUP — от нуля до рабочего (copy-paste)

> **Node / pnpm.** Ревью прошло на **Node 22.22 + pnpm 11.10.0**, и на них всё зелёное (doctor,
> 6140 тестов). Репозиторий пинит `.nvmrc → 24`, но на 24 мы НЕ проверяли — для точного повторения
> того, что в видео, ставь Node **22.x**. Переменные окружения не нужны — **никаких env**.
>
> **Почему `--ignore-scripts`.** В `apps/sandbox/package.json:14` есть `"postinstall": "astryx init
> --features agents"`, а в корне — `"prepare": "husky install"`. Обычный `pnpm install` выполнил бы
> их автоматически (safety-gate флаг). Разбор `packages/cli/src/commands/init.mjs` показал, что
> нагрузка безобидна (пишет локальные doc-файлы через `fs`), но снимаем и ставим всё равно с
> отключёнными скриптами.

```bash
# 0. клон (READY уже склонирован; строка — для установки с нуля) — ~5 с
git clone --depth 1 https://github.com/facebook/astryx episodes/2026-07-ep001/sandbox/astryx
cd episodes/2026-07-ep001/sandbox/astryx

# 1. install — ~12 с, success: "Lockfile ... passes supply-chain policies" + "Done"
#    (26 workspace-проектов, 914 пакетов, 0 ошибок)
pnpm install --ignore-scripts

# 2. CLI работает БЕЗ сборки — success: печатает список команд (component, docs, swizzle, doctor, ...)
node packages/cli/bin/astryx.mjs help

# 3. сборка публикуемых пакетов ЧЕРЕЗ pnpm (иначе node_modules/.bin не в PATH — см. Failure recipes)
#    build — ~несколько с, success: dist/vite.mjs + .d.ts
pnpm -F @astryxdesign/build build
#    core — ~десятки с, success: Babel 477 файлов, StyleX 5445 правил → dist/astryx.css (~118 КБ) + UMD
pnpm -F @astryxdesign/core build
```

---

## Scenes  <!-- один блок на каждый [СКРИНКАСТ] из script.md, в порядке съёмки; пункт N из SHOTLIST → #scene-N -->

<a id="scene-1"></a>
### SCENE 1 — холодный старт: маркетинг → терминал  ·  _beat: Хук_
- **Do:** в браузере открой `https://github.com/facebook/astryx`, покажи шапку README с «8 лет
  внутри Meta» и «13 000+ приложений». Затем переключись на терминал в `sandbox/astryx` и **набери**
  (пока не запуская) `pnpm install`.
- **On screen:** GitHub-страница репозитория с громким маркетингом; затем терминал с набранной командой.
- **Wait/Cut:** режь ровно на нажатии Enter — реальный install это сцена 4. **Не запускай здесь голый
  `pnpm install`** (сработает postinstall) — команда нужна только как визуал.
- **Reset:** — (браузер/визуал, повторяемо).

<a id="scene-2"></a>
### SCENE 2 — что обещает README  ·  _beat: Что это за репо_
- **Do:** открой README (страница GitHub или `sandbox/astryx/README.md` в редакторе) и пролистай:
  150+ компонентов, семь готовых тем, раздел про CLI.
- **On screen:** секции README со списком компонентов, семью темами, командами CLI.
- **Wait/Cut:** — (в монтаже поверх идёт `[АНИМАЦИЯ: StarChart]` — это не скринкаст).
- **Reset:** — (только прокрутка, read-only).

<a id="scene-3"></a>
### SCENE 3 — safety-gate крупным планом  ·  _beat: Живой тест_
- **Do:** открой `apps/sandbox/package.json`, подсветь строку 14 `"postinstall": "astryx init
  --features agents"`. Затем открой `packages/cli/src/commands/init.mjs` и покажи фрагмент, где
  команда просто пишет локальные doc-файлы (AGENTS.md/CLAUDE.md) через `fs` — без сети и без eval.
- **On screen:** подсвеченная строка postinstall; рядом код init.mjs, пишущий локальные доки.
- **Wait/Cut:** —
- **Reset:** — (read-only).

<a id="scene-4"></a>
### SCENE 4 — чистая установка  ·  _beat: Живой тест_
- **Do:** в чистом состоянии (см. Prepared states): `pnpm install --ignore-scripts`
- **On screen:** pnpm ставит 26 workspace-проектов / 914 пакетов, финиширует за ~12 с, печатает
  строку о прохождении supply-chain-политики и «Done».
- **Wait/Cut:** ~12 с — весь прогон влезает в один дубль; включай запись перед Enter.
- **Reset:** `rm -rf node_modules packages/*/node_modules apps/*/node_modules internal/*/node_modules`
  и повтори (~12 с), либо снимай в `astryx-clean`, чтобы не разбирать READY.

<a id="scene-5"></a>
### SCENE 5 — доки компонента реальны  ·  _beat: Живой тест_
- **Do:** `node packages/cli/bin/astryx.mjs component Button --dense`
- **On screen:** полная карточка компонента — анатомия, Do/Don't, таблица props с типами и дефолтами.
- **Wait/Cut:** мгновенно (CLI работает без сборки).
- **Reset:** — (идемпотентно).

<a id="scene-6"></a>
### SCENE 6 — самодиагностика  ·  _beat: Живой тест_
- **Do:** `node packages/cli/bin/astryx.mjs doctor`
- **On screen:** итоговая строка — «Summary: 4 passed, 2 warnings, 0 failures, 2 info», ниже «No
  failures». Node определён, peer-зависимости StyleX/React удовлетворены, определён pnpm. **2 warnings
  — косметические** (не failures); на вердикт не влияют — их можно спокойно оставить в кадре.
- **Wait/Cut:** мгновенно.
- **Reset:** —

<a id="scene-7"></a>
### SCENE 7 — сборка: провал прямого запуска → успех через pnpm  ·  _beat: Живой тест_
- **Do:** сначала провал — `cd packages/build && node build.mjs` (прямой запуск в обход pnpm; вернись
  в корень: `cd ../..`). Затем успех — `pnpm -F @astryxdesign/build build`.
- **On screen:** сперва `/bin/sh: tsc: command not found` и `Error: Command failed: tsc --project
  tsconfig.build.json` (status 127); затем чистая сборка → `dist/vite.mjs` + `.d.ts`.
- **Wait/Cut:** провал мгновенный; успешная сборка — несколько секунд. (Подробности — Failure recipes.)
- **Reset:** детерминировано, повторяемо; чтобы пере-собрать начисто — `rm -rf packages/build/dist`.

<a id="scene-8"></a>
### SCENE 8 — кульминация: все тесты зелёные  ·  _beat: Живой тест_
- **Do:** из корня репо `pnpm test`
- **On screen:** итог vitest «Test Files 329 passed (329) / Tests 6140 passed (6140)».
- **Wait/Cut:** **~70 с прогон** — включи запись и дай отработать, либо сними финальный экран-итог.
  Денежный кадр — зелёный сводный экран. В монтаже сверху `[АНИМАЦИЯ: счётчик до 6140]`.
- **Reset:** — (идемпотентно).
- **Переиспользование:** этот же прогон даёт «зелёную» половину сцены 9 — сними обе из ОДНОГО
  `pnpm test`, чтобы не ждать 70 с дважды.

<a id="scene-9"></a>
### SCENE 9 — «README врёт» по-техничке: cwd ломает тесты  ·  _beat: Где README врёт_
- **Do:** красная половина — `pnpm -F @astryxdesign/core test` (28 падений). Зелёная половина —
  `pnpm test` из корня (переиспользуй кадр из сцены 8).
- **On screen:** рядом две команды — слева 28 падений с `ENOENT: no such file or directory, scandir
  'packages/core/src'`; справа полностью зелёные 6140.
- **Wait/Cut:** прогон core-тестов короче полного; полную «зелёнку» не запускай повторно — бери из сцены 8.
- **Reset:** — (детерминировано; см. Failure recipes).

<a id="scene-10"></a>
### SCENE 10 — «README врёт» по-маркетингу  ·  _beat: Где README врёт_
- **Do:** снова покажи шапку README — «8 лет внутри Meta», «13 000+ приложений» (те же, что в сцене 1).
- **On screen:** заголовок с непроверяемыми маркетинговыми цифрами.
- **Wait/Cut:** — (та же картинка, но голос скептичнее — режиссёрская пометка, не команда).
- **Reset:** —

<a id="scene-11"></a>
### SCENE 11 — итоговый чек-лист  ·  _beat: Вердикт_
- **Do:** покажи сводный чек-лист (это host-компонованный слайд/графика, **не команда песочницы**):
  установка ✓ · CLI ✓ · доки ✓ · сборка ✓ · 6140 тестов ✓.
- **On screen:** пять пунктов, все отмечены галочкой.
- **Wait/Cut:** — (в монтаже сверху `[АНИМАЦИЯ: VerdictCard — ГОДНОТА]`).
- **Reset:** — (собирается в редакторе/графике, не воспроизводится в песочнице).

---

## Failure recipes

<!-- «Интересные» поломки из report.md, воспроизводимые ПО ТРЕБОВАНИЮ. Обе — детерминированные
     (артефакты способа запуска, не баги продукта), так что «capture from agent logs» не нужно. -->

- **`tsc: command not found`** (сцена 7) — триггер: `cd packages/build && node build.mjs`
  (прямой запуск в обход pnpm → `node_modules/.bin` не попадает в PATH) → `/bin/sh: tsc: command not found`,
  `Error: Command failed: tsc --project tsconfig.build.json` (status 127). **Детерминировано.**
  Правильная команда: `pnpm -F @astryxdesign/build build`.
- **28 падений `ENOENT ... packages/core/src`** (сцена 9) — триггер: `pnpm -F @astryxdesign/core test`
  → 28 из 6140 падают с `ENOENT: no such file or directory, scandir 'packages/core/src'` (из
  `packages/cli/src/lib/component-discovery.mjs`: pnpm ставит cwd в `packages/core`, а CLI-тесты
  читают путь `packages/core/src` относительно cwd). **Детерминировано.** Правильная команда:
  `pnpm test` из корня → все 6140 зелёные.
- **(косметика, не снимаем)** React `act(...)` warning в тестах Table/columnResize и «Promise ... was
  not awaited» в `scripts/build-css.test.mjs` — шум в логах, тесты всё равно проходят. На вердикт и на
  съёмку не влияет.
