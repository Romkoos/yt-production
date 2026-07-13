# SHOTLIST — 2026-07-ep002 (Zackriya-Solutions/meetily)

Чек-лист записи для Screen Studio. Каждый `[СКРИНКАСТ]`-кью из script.md, по порядку.
Это clock (b): запись делается позже, тайминга здесь нет — только что снять.
Каждый пункт N ведёт в свой блок `#scene-N` в [REPRO.md](REPRO.md) — там точные команды,
что появится на экране, WAIT/CUT и как переснять.


## Хук

- [ ] 1. страница репозитория на GitHub — крупно строка описания с тремя обещаниями («4x faster», «speaker diarization», «100% local processing»), рядом счётчик звёзд · [↗ REPRO](REPRO.md#scene-1)

## Живой тест

- [ ] 2. скачать dmg с GitHub Releases через браузер, двойной клик в Finder — на экране остаётся диалог macOS о том, что образ не может быть проверен; рядом открыт README со своими четырьмя шагами · [↗ REPRO](REPRO.md#scene-2)
- [ ] 3. в терминале два вызова spctl подряд — по .app внутри образа (accepted, Notarized) и по самому .dmg (rejected, Unnotarized); оба вывода в одном кадре · [↗ REPRO](REPRO.md#scene-3)
- [ ] 4. запуск meetily из терминала, в кадре лог — «Hardware acceleration support: enabled», «Application setup complete»; следом открывается окно приложения · [↗ REPRO](REPRO.md#scene-4)
- [ ] 5. приложение запущено, рядом в терминале lsof по его PID — список исходящих соединений пуст · [↗ REPRO](REPRO.md#scene-5)
- [ ] 6. импорт одного и того же аудиофайла, транскрипция через Parakeet и через Whisper, на экране секундомер; в конце — оба времени рядом · [↗ REPRO](REPRO.md#scene-6)

## Где README врёт

- [ ] 7. strings по бинарю с грепом — на экране адрес PostHog; сразу рядом строка README «No data ever leaves your computer» · [↗ REPRO](REPRO.md#scene-7)
- [ ] 8. git log с поиском по строке миграции аналитики — на экране коммит от шестого мая: «fix: make analytics opt-in by default» · [↗ REPRO](REPRO.md#scene-8)
- [ ] 9. рядом в одном кадре — строка описания репы со словами «speaker diarization» и строка README «Speaker diarization is planned for PRO in mid-June»; поверх — календарь с текущей датой · [↗ REPRO](REPRO.md#scene-9)
