# REPRO — ep-mini (o/r)

<!-- ownership comment that must not leak into the parsed output -->

**Repo:** https://github.com/o/r  ·  **Verdict:** ХАЙП  ·  **Sandbox:** `episodes/ep-mini/sandbox/r`
**Recording time budget:** ~30 мин на весь линейный дубль, если модели скачаны заранее.

---

## Clean slate

```bash
# стереть следы продукта на машине записи — ДО дубля
rm -rf ~/Library/Application\ Support/r ~/Downloads/app.dmg
xattr -d com.apple.quarantine ~/Downloads/* 2>/dev/null || true
```

---

## User flow

<a id="scene-1"></a>
### FLOW 1 — витрина репы  ·  _beat: Хук_
- **Do:** открыть `https://github.com/o/r`, навести на строку описания.
- **On screen:** строка описания с тремя обещаниями + «20k stars».
- **Wait/Cut:** — (статичная страница)
- **Reset:** — (идемпотентно)

<a id="scene-2"></a>
### FLOW 2 — качаем и ставим: Gatekeeper блокирует  ·  _beat: Живой тест_
- **Do:** скачать dmg **в браузере** (не через gh — иначе не будет флага карантина) → двойной клик в Finder. Первый же шаг README не срабатывает.
- **On screen:** диалог macOS о том, что образ не может быть проверен.
- **Wait/Cut:** — (срабатывает мгновенно)
- **Reset:** пере-скачать в браузере, чтобы вернуть флаг карантина.

---

## Evidence inserts

<a id="scene-3"></a>
### EVIDENCE 3 — приложение нотаризовано, коробка нет  ·  _beat: Живой тест_
- **Anchor:** сразу после того как Gatekeeper показал диалог (шаг 2) — доказываем, что нотаризован не образ.
- **Do:**
  ```bash
  spctl -a -vvv /Volumes/r/app.app
  spctl -a -vvv -t open dist/quarantined.dmg
  ```
- **On screen:** `accepted / Notarized` и `rejected / Unnotarized` в одном кадре.
- **Wait/Cut:** — (мгновенно). Оба вывода должны попасть в один кадр.
- ⚠️ **Чего этот вывод НЕ доказывает:** что подписана сама коробка — проверяем ровно две вещи.

---

## Environment caveats

- **Диалог блокировки Gatekeeper** — существует только в первом прогоне: после первого «Открыть» macOS кэширует вердикт и блок больше не показывается. Снять на чистом листе, один дубль.

---

## Prepared states

<!-- off-camera only -->

- **МОДЕЛИ** — `~/.cache/r/models` — веса скачаны заранее (~4 ГБ), чтобы дубль не ждал загрузку. В кадре не показываем.
