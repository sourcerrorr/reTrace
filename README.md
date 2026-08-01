# reTrace

reTrace is a browser-based hand rehabilitation and motor-practice tool. It uses
your webcam to track your index fingertip in real time and turns simple
tracing and reaching exercises into a guided practice session, with scores and
progress history — no app install, no account, and nothing uploaded anywhere.

All hand tracking runs locally in the browser using [MediaPipe Tasks
Vision](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker);
video frames never leave the device.

## What it does

- **Two exercise categories**
  - **Tracing** — follow a guide shape (circle, square, triangle, line,
    spiral, wave) drawn on screen, starting from a marked point.
  - **Reach** — touch a series of on-screen targets, in variations: lateral
    sweep, upward reach, a moving target you track continuously, a
    stay-inside hold, and scattered targets.
- **Three difficulty levels** (easy / medium / hard) that scale target size,
  dwell time, target count, and target speed.
- **Two input modes** — hand tracking via webcam (pinch to draw / dwell to
  reach) or mouse, selectable per session so the app is usable without a
  camera.
- **A session** is five exercises of the chosen category, played back to
  back, ending on a results screen with per-exercise and session-average
  scores.
- **Scoring engine** — pure, deterministic scorers (no ML) for each exercise
  mechanic:
  - Tracing: accuracy (closeness to the guide), completion, smoothness.
  - Reach: completion, consistency, path efficiency.
  - Hold: time inside target, longest continuous hold, interruptions.
  - Moving target: sustained contact and dropouts while tracking.
- **Progress history** — completed sessions are saved to the browser's
  `localStorage` (nothing sent to a server) and shown as a trend chart and
  session list on the Progress screen.
- **Bilingual UI** — English and Georgian (ქართული), with all user-facing
  copy centralized in one typed dictionary so new languages are a mechanical
  addition.
- **Privacy-first by design** — camera frames are processed in-browser only;
  the camera stream stops the moment a session ends or the tab closes.

## Tech stack

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) for dev server and bundling
- [MediaPipe Tasks Vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) for hand landmark detection
- [Tailwind CSS 4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) primitives
- [Recharts](https://recharts.org/) for the progress chart
- Docker + Nginx for a static production deployment

## Getting started

Requirements: Node.js 20+, a webcam if you want to use hand tracking (the
mouse input mode works without one).

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`. Open it in a browser and
grant camera access when prompted (or pick "Mouse" as the input method on the
setup screen to skip that entirely).

To build a production bundle:

```bash
npm run build
```

Output goes to `dist/`.

## Running with Docker

A multi-stage Dockerfile builds the app and serves the static output with
Nginx.

```bash
docker compose up --build
```

The app will be available at `http://localhost:8080`.

## Project structure

```
src/
  app/
    App.tsx              # screen routing: exercises → session → results → progress
    SessionScreen.tsx     # the active-exercise screen (camera, canvas, targets, HUD)
    exercises.ts          # pure exercise generation (shapes, targets, difficulty tuning)
    history.ts             # localStorage session history (read/write/aggregate)
    input.ts               # hand input abstraction: mouse source + MediaPipe hand-tracking source
    theme.ts                # shared color/typography tokens
    components/
      HandCamera.tsx        # webcam capture + preview, camera permission/error states
      ui/                    # shadcn/ui-derived primitives (buttons, dialogs, etc.)
    hooks/
      useTracingRuntime.ts    # drawing loop + tracing metrics
      useReachRuntime.ts       # target hit-testing + reach metrics
      useHoldRuntime.ts         # stay-inside-target stability loop
      useMovingTargetRuntime.ts # moving-target position/timing loop
    scoring/
      index.ts               # routes an exercise + collected metrics to the right scorer
      scoreTracing.ts, scoreReach.ts, scoreHold.ts, scoreMovingTarget.ts
    i18n/
      translations.ts         # English (source of truth) + Georgian dictionaries
      LanguageProvider.tsx     # language context + persistence
  main.tsx                    # app entry point
docs/
  SPRINT_PLAN.md               # project roadmap and current status
```

## How scoring works

Every exercise ends with a `ScoreResult` produced by a pure scoring function
— no network calls, no black box:

- **Tracing** — accuracy measures how closely your drawn line follows the
  guide path; completion measures how much of the shape you actually
  covered; smoothness measures how steady vs. jerky your movement was.
- **Reach** — completion is how many targets you hit; consistency tracks
  whether your finger slipped off a target before it counted; path
  efficiency compares your actual path to a straight line between targets.
- **Hold** — scored from total time spent inside the target, the longest
  unbroken hold, and how many times you slipped out.
- **Moving target** — scored from sustained on-target contact time and how
  often you lost the target while it moved.

See `docs/SPRINT_PLAN.md` for the fuller plain-language breakdown and the
current project roadmap.

## Status

This is an active thesis project, not a finished clinical product. It is a
practice tool, not a medical diagnostic device, and does not replace
guidance from a healthcare professional. See `docs/SPRINT_PLAN.md` for
what's done and what's still in progress.

## License / attributions

UI components adapted from [shadcn/ui](https://ui.shadcn.com/) (MIT). See
`ATTRIBUTIONS.md` for details.
