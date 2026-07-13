# SHOTLIST — 2026-07-ep001 (facebook/astryx)

Чек-лист записи для Screen Studio. Каждый `[СКРИНКАСТ]`-кью из script.md, по порядку.
Это clock (b): запись делается позже, тайминга здесь нет — только что снять.
Каждый пункт N ведёт в свой блок `#scene-N` в [REPRO.md](REPRO.md) — там точные команды,
что появится на экране, WAIT/CUT и как переснять.


## Хук

- [ ] 1. крупным планом — GitHub-страница astryx с заголовком про «8 лет в Meta» и «13 000+ приложений», затем резкий переход на терминал с командой pnpm install · [↗ REPRO](REPRO.md#scene-1)

## Что это за репо

- [ ] 2. полистать README репозитория — список из 150+ компонентов, семь готовых тем, раздел про CLI · [↗ REPRO](REPRO.md#scene-2)

## Живой тест

- [ ] 3. строка "postinstall": "astryx init --features agents" в apps/sandbox/package.json крупным планом, рядом — фрагмент кода init.mjs, который просто пишет локальные doc-файлы через fs, без сети и без eval · [↗ REPRO](REPRO.md#scene-3)
- [ ] 4. терминал — pnpm install --ignore-scripts выполняется чисто за ~12 секунд, в конце — строка о прохождении supply-chain-политики · [↗ REPRO](REPRO.md#scene-4)
- [ ] 5. запуск node packages/cli/bin/astryx.mjs component Button --dense, полный вывод карточки компонента на экране · [↗ REPRO](REPRO.md#scene-5)
- [ ] 6. вывод astryx doctor — "4 passed, 0 failures" · [↗ REPRO](REPRO.md#scene-6)
- [ ] 7. сначала падение "tsc: command not found" при прямом node build.mjs, затем успешная сборка через pnpm -F @astryxdesign/build build · [↗ REPRO](REPRO.md#scene-7)
- [ ] 8. финальная строка терминала — "Test Files 329 passed (329) / Tests 6140 passed (6140)" · [↗ REPRO](REPRO.md#scene-8)

## Где README врёт

- [ ] 9. сравнение двух команд рядом — pnpm -F @astryxdesign/core test с 28 падениями и pnpm test из корня с полностью зелёным результатом · [↗ REPRO](REPRO.md#scene-9)
- [ ] 10. снова заголовок README с цифрами «8 лет» и «13 000+ приложений» — на этот раз с более скептической интонацией голоса · [↗ REPRO](REPRO.md#scene-10)

## Вердикт

- [ ] 11. экран с итоговым списком — установка, CLI, доки, сборка, тесты — все пункты отмечены галочкой · [↗ REPRO](REPRO.md#scene-11)
