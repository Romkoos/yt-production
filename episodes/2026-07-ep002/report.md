# Review: meetily (Zackriya-Solutions)

**URL:** https://github.com/Zackriya-Solutions/meetily
**Reviewed:** 2026-07-13

Версия под тестом: **v0.4.0** (релиз 2026-06-05), `meetily_0.4.0_aarch64.dmg`,
sha256 `a38eab454a8dd3b3e0956f24915564e5bc08222dcf007342446f916f51caa728`.
Хост: macOS (Darwin 25.3), arm64.

---

## Заявлено (Claimed)

Из GitHub-описания репозитория (тайтл-строка, которую видят все, кто пришёл из trending):

> «Privacy first, AI meeting assistant with **4x faster transcription**, **speaker
> diarization**, and summarization built on Rust. **100% local processing.**»

Из README:

- «A privacy-first AI meeting assistant that captures, transcribes, and summarizes
  meetings **entirely on your infrastructure**» (README:33).
- «**Privacy First:** All processing happens locally on your device.» (README:75).
- «**Local First:** All processing is done on your machine. **No data ever leaves your
  computer.**» (README:97).
- «Transcribe meetings entirely on your device using Whisper or Parakeet models. **No
  cloud required.**» (README:138).
- «**Flexible AI Provider Support:** Choose from Ollama (local), Claude, Groq, OpenRouter,
  or use your own OpenAI-compatible endpoint.» (README:102).
- Установка на macOS: «Download `meetily_0.4.0_aarch64.dmg` → Open the downloaded `.dmg`
  → Drag Meetily to Applications → Open Meetily» (README:113–116).

Ключевое замечание по клеймам: **«4x faster» не встречается в README ни разу.** Оно живёт
только в GitHub-описании репы. Ни бенчмарка, ни методики, ни базы сравнения (4x относительно
чего? какой модели? какого железа?) в репозитории нет.

---

## Работает (Works)

- **Приложение честно локальное — это подтверждено, а не принято на слово.** За ~20 секунд
  работы после старта у процесса **ноль исходящих сокетов** (`lsof -i -a -p <pid>`): ни
  телеметрии, ни проверки обновлений, ни единого коннекта. Для приложения, которое продаёт
  приватность, это главный клейм — и на старте он держится.
- **Аналитика выключена по умолчанию.** В `~/Library/Application Support/com.meetily.ai/analytics.json`
  на первом запуске: `"analyticsOptedIn": false`. Opt-in, не opt-out.
- Приложение **стартует чисто** с первого раза, без плясок. Из лога: Metal GPU-ускорение
  подхватилось (`macOS detected - attempting to enable Metal GPU acceleration` →
  `Hardware acceleration support: enabled`), поднялись оба движка (Whisper и Parakeet),
  создалась SQLite-база, инициализировались уведомления. Ошибок в логе нет.
- **Приложение подписано настоящим Developer ID** — `ZACKRIYA SOLUTIONS (554AZZ38TB)`,
  hardened runtime, валидный timestamp. `.app` **нотаризован** и Gatekeeper его принимает
  (`spctl -a`: `accepted, source=Notarized Developer ID`). За сертификат Apple платят живые
  деньги — это не анонимный дроп.
- Репозиторий **реальный и старый**: первый коммит 2024-12-26, **556 коммитов**, 19 месяцев
  разработки. Это не пустышка, собранная за выходные.
- Соотношение звёзд к загрузкам **здоровое**: ~24k звёзд против ~21k скачиваний релиза
  (9,235 `.dmg` + 12,096 `.exe`). У накрученных проектов звёзды есть, а загрузок нет.

---

## Сломалось (Broke)

- **Установочный DMG не нотаризован — и Gatekeeper его блокирует.** Приложение внутри
  нотаризовано, а обёртка-образ — нет:

  ```
  $ spctl -a -vvv -t open --context context:primary-signature meetily_0.4.0_aarch64.dmg
  meetily_0.4.0_aarch64.dmg: rejected
  source=Unnotarized Developer ID
  origin=Developer ID Application: ZACKRIYA SOLUTIONS (554AZZ38TB)
  ```

  Проверено именно в пользовательском сценарии: на копию DMG выставлен флаг карантина
  `com.apple.quarantine` (его ставит любой браузер при скачивании) — вердикт тот же,
  `rejected`. То есть человек, который выполняет README буквально («скачай .dmg, открой
  его»), упирается в стену **на первом же шаге**. `hdiutil attach` из терминала образ
  монтирует — CLI идёт мимо LaunchServices, — но обычный пользователь кликает в Finder.

  README об этом не предупреждает ни словом: нет ни «right-click → Open», ни
  `xattr -d com.apple.quarantine`. Четыре шага установки, и первый же не работает.

- **«4x faster» — НЕ ИЗМЕРЕНО, и я не буду делать вид, что измерил.** Движок транскрипции
  вкомпилирован в Tauri-бинарь, отдельного CLI у него нет, а модели (Parakeet + summary)
  качаются через GUI-онбординг, который headless не проходится
  (`onboarding-status.json`: `"parakeet": "not_downloaded"`). Замер скорости — под
  секундомер на записи, рецепт в `REPRO.md`. В ролике **нельзя** называть никакую цифру
  ускорения, пока она не снята руками.

---

## Подозрительно (Suspicious)

**1. Safety gate — пройден чисто.** Ради полноты: lifecycle-скриптов в `frontend/package.json`
нет; единственный `curl | sh` во всём репозитории — это установка `rustup` в
`frontend/README.md:53`, то есть инструкция человеку, а не их payload; сеть в build-скриптах
ведёт только на `huggingface.co/ggerganov/whisper.cpp` за GGML-моделями; обфускации и
base64-блобов нет. Ничего блокирующего.

**2. Заявленной в описании репы диаризации спикеров в продукте НЕТ.** GitHub-тайтл рекламирует
`speaker diarization` как готовую фичу. README, дважды, говорит другое:

> «Speaker diarization is also planned for **PRO** in **mid-June**.» (README:47)
> «Speaker diarization is **planned** for mid-June, bringing automatic speaker separation
> to **PRO** meetings.» (README:223)

То есть фича (а) не существует, (б) обещана в **платный** тариф, а не в open-source, и
(в) обещана на **середину июня** — сейчас середина июля, и коммитов с 5 июня нет вообще.
Это самое чистое расхождение «обещано против реальности» во всём разборе.

**3. PostHog внутри «no data ever leaves your computer».** В бинаре зашит эндпоинт
`https://us.i.posthog.com/i/v0/e/`. Сейчас аналитика opt-in и по умолчанию выключена — но
git показывает, когда это стало правдой:

```
2026-02-25 · feat(analytics): instrument import and enhance transcript workflows
2026-05-06 · fix: make analytics opt-in by default [skip ci]
2026-05-11 · Merge pull request #452 from Zackriya-Solutions/fix/analytics-default-off
```

С февраля по май 2026 PostHog-аналитика была **включена по умолчанию** в приложении, чей
README всё это время обещал, что данные не покидают компьютер. Починили сами, и это им в
плюс — но клейм был ложным несколько месяцев, и формулировка README не изменилась до сих пор.

**4. «100% local» и облачные провайдеры сосуществуют в одном README.** Строка 97 — «No data
ever leaves your computer», строка 102 — «Choose from Ollama (local), **Claude, Groq,
OpenRouter**, or your own OpenAI-compatible endpoint». В бинаре подтверждаются зашитые
`api.openai.com`, `api.anthropic.com`, `api.groq.com`. Транскрипция действительно локальная;
но **суммаризация уедет в облако**, если пользователь выберет любой провайдер кроме Ollama.
Абсолютное «no data ever leaves your computer» — неправда как утверждение о продукте; правда
только про конкретную конфигурацию.

**5. Open-source как воронка в платный PRO.** README:47 — купон `LAUNCH20`, «20% off»,
ссылка на `meetily.ai/pro/`. Само по себе законно и нормально, но это меняет чтение
приоритетов: самая громкая фича из тайтла репы уехала в платный тариф.

**Star-forensics.** Всплеск не объясняется разработкой: **+7,440 звёзд за неделю при полном
отсутствии коммитов с 5 июня** (последний коммит и последний релиз — один день). Растёт
репозиторий, в который месяц не пишут. Против версии «накрутка» играют: возраст (19 мес.),
556 коммитов, платный Apple Developer ID, ~21k реальных загрузок релиза. Похоже на внешний
вирусный всплеск (HN/Reddit/рассылка), а не на ботов. **Происхождение всплеска по самому
репозиторию не устанавливается — в ролике это утверждать нельзя без отдельной проверки
источника трафика.**

---

## Моменты для видео (Video moments — semantic, NO timecodes)

- Момент, где `spctl` на скачанном DMG (с выставленным флагом карантина, как у браузера)
  печатает `rejected / source=Unnotarized Developer ID` — а рядом на экране открыт README с
  его четырьмя шагами установки, первый из которых «Open the downloaded .dmg».
- Контраст на одном экране: `spctl` по `.app` → `accepted, Notarized`, `spctl` по `.dmg` →
  `rejected, Unnotarized`. Приложение нотаризовали, коробку — забыли.
- Момент запуска приложения с `lsof -i` рядом: ноль исходящих соединений. Это сцена, где мы
  **хвалим** — клейм про локальность подтверждается приборами.
- `strings` по бинарю показывает `us.i.posthog.com` — сразу после того, как на экране была
  строка README «No data ever leaves your computer».
- `git log -S analyticsDefaultOffMigration` выводит `2026-05-06 · fix: make analytics opt-in
  by default` — доказательство, что до мая аналитика была включена по умолчанию.
- Момент, где на экране рядом GitHub-описание репы со словами «speaker diarization» и строка
  README «Speaker diarization is planned for PRO in mid-June» — при том, что на календаре
  июль.
- `git log -1` показывает последний коммит от 5 июня — рядом со счётчиком +7,440 звёзд за
  неделю.
- Замер скорости под секундомер (снимается на записи — см. REPRO): реальное время
  транскрипции против заявленного «4x faster», у которого в репозитории нет ни бенчмарка,
  ни базы сравнения.

---

## Черновой вердикт (Draft verdict lean)

**ХАЙП** — но с оговорками, которые обязаны прозвучать, иначе вердикт будет нечестным. Это не
пустышка и точно не накрутка: 19 месяцев работы, 556 коммитов, платный Developer ID, 21 тысяча
реальных загрузок, приложение запускается с первого раза, Metal подхватывается, и — главное —
клейм про локальность подтверждается приборами: ноль исходящих соединений, аналитика opt-in.
За это надо отдать должное прямо в кадре. Ровно поэтому «ХАЙП», а не «ГОДНОТА»: проблема не в
продукте, а в **дистанции между витриной и продуктом**. Строка, которой репозиторий встречает
десятки тысяч человек из trending, обещает три вещи — «4x faster», «speaker diarization»,
«100% local». Из них: ускорение не подкреплено в репозитории ничем (ни бенчмарка, ни
методики); диаризации **не существует**, она обещана в платный PRO на середину июня и
просрочена на месяц; а «100% local» было буквально неправдой с февраля по май, пока PostHog
слал события по умолчанию, и остаётся условной правдой сейчас — суммаризация уезжает в облако,
если выбрать Claude или Groq. Добавь к этому, что установка ломается на первом же шаге README,
потому что DMG забыли нотаризовать. Хороший инструмент, которому написали витрину громче, чем
он есть. Финальный вердикт — за хостом после замера скорости на записи: если «4x» подтвердится
секундомером, разговор смещается в сторону ГОДНОТЫ с претензией к маркетингу; если нет — ХАЙП
остаётся, и заслуженно.
