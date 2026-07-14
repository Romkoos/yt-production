# REPRO — ep-mini (o/r)

<!-- ownership comment that must not leak into the parsed output -->

**Repo:** https://github.com/o/r  ·  **Verdict:** ХАЙП  ·  **Sandbox:** `episodes/ep-mini/sandbox/r`
**Recording time budget:** ~30 мин на 3 сцены, если модели скачаны заранее.

---

## Prepared states

- **READY-APP** — `sandbox/run/app` — распаковано, запускается напрямую.
- **READY-DMG** — `sandbox/dist/app.dmg` — скачан через `gh`, флага карантина НЕТ.

---

## SETUP — zero to running (copy-paste)

```bash
# 1. Скачать релиз — ~10s, success: файл на диске
gh release download v1 --repo o/r --dir dist
```

---

## Scenes  <!-- one block per [СКРИНКАСТ] cue; script #N → #scene-N -->

⚠️ **Сцену 2 снимай ПЕРВОЙ по времени** — только браузер ставит флаг карантина.

<a id="scene-1"></a>
### SCENE 1 — витрина репы  ·  _beat: Хук_
- **Do:** открыть `https://github.com/o/r`, навести на строку описания.
- **On screen:** строка описания с тремя обещаниями + «20k stars».
- **Wait/Cut:** — (статичная страница)
- **Reset:** — (идемпотентно)

<a id="scene-2"></a>
### SCENE 2 — Gatekeeper блокирует установку  ·  _beat: Живой тест_
- **Do:** скачать dmg **браузером** → двойной клик в Finder.
- **On screen:** диалог macOS о том, что образ не может быть проверен.
- **Wait/Cut:** — (срабатывает мгновенно)
- **Reset:** файл должен сохранить флаг карантина.
- **Failure recipe:** см. «DMG не нотаризован» ниже.

<a id="scene-3"></a>
### SCENE 3 — приложение нотаризовано, коробка нет  ·  _beat: Живой тест_
- **Do:**
  ```bash
  spctl -a -vvv /Volumes/r/app.app
  spctl -a -vvv -t open dist/quarantined.dmg
  ```
- **On screen:** `accepted / Notarized` и `rejected / Unnotarized` в одном кадре.
- **Wait/Cut:** — (мгновенно). Оба вывода должны попасть в один кадр.
- **Reset:** — (идемпотентно)

---

## Failure recipes

- **DMG не нотаризован → Gatekeeper блокирует установку** — детерминированно:

  ```bash
  xattr -w com.apple.quarantine "0083;0;Safari;" quarantined.dmg
  spctl -a -vvv -t open quarantined.dmg
  ```
