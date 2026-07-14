# Сценарий: {{REPO}} — {{VERDICT}}?

<!-- Tags:
     [ГОЛОС] voiceover line
     [СКРИНКАСТ #N: что показать] — shooting instruction (clock b), NOT a timecode.
        N is assigned in narrative order and is the SINGLE source of scene identity:
        REPRO.md's #scene-N and RECORDING.md both derive from it.
     [АНИМАЦИЯ A<n>: ...] Remotion scene cue
     [МЕМ M<n>: ...] meme cue
     [SHORT cut S<n>: <narrative beat>] — CANDIDATE Short (clock c). Real final-video
        timecodes are reconciled after the Resolve edit; /cut-shorts uses THOSE.

     Number each kind sequentially from 1, in narrative order. No gaps, no duplicates,
     no out-of-order — `pnpm prep` hard-fails (writing nothing) on all three. -->

## Хук (0–15 сек)
[ГОЛОС] ...
[СКРИНКАСТ #1: ...]

## Что это за репо (15–60 сек)
[ГОЛОС] ...
[АНИМАЦИЯ A1: StarChart — рост звёзд]

## Живой тест (основа)
[ГОЛОС] ...
[СКРИНКАСТ #2: ...]
[SHORT cut S1: <the funniest failure beat>]

## Где README врёт
[ГОЛОС] ...

## Вердикт
[ГОЛОС] ...
[АНИМАЦИЯ A2: VerdictCard — {{VERDICT}}]
