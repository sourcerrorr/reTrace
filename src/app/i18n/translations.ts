/* ─── translation dictionaries ────────────────────────────────────────────── */
/**
 * All user-facing copy lives here, one dictionary per language. The English
 * dictionary is the source of truth: `Translations = typeof en`, so every other
 * language is type-checked to have the exact same shape (including the little
 * parameterised functions like `hold(seconds)` and `reachedAll(n)`).
 *
 * Adding a language is intentionally mechanical — write a new dictionary that
 * satisfies `Translations`, then register it in `DICTS`/`LANGUAGES`
 * (see LanguageProvider.tsx). No application logic changes.
 */

export type Language = "en" | "ka";

/* English — the reference shape. Do not add `as const`: values must stay `string`
   so the other dictionaries can supply their own text for the same keys. */
export const en = {
  /** App name — a brand, deliberately left untranslated everywhere it appears. */
  nav: {
    home: "Home",
    exercises: "Exercises",
    progress: "Progress",
    settings: "Settings",
  },

  /** Exercise category names, shared by the cards, the progress filters and the
   *  session list so a category always reads the same across screens. */
  exerciseName: {
    tracing: "Tracing",
    reach: "Reach to target",
  },

  /** Metric names shared between the results cards and the progress chart. */
  metrics: {
    accuracy: "Accuracy",
    smoothness: "Smoothness",
  },

  common: {
    tryAgain: "Try again",
    recordingLocally: "Recording locally · nothing uploaded",
  },

  setup: {
    question: "How challenging should today feel?",
    easyTitle: "Easy",
    easyDesc: "Larger targets, more time.",
    mediumTitle: "Medium",
    mediumDesc: "Balanced practice.",
    hardTitle: "Hard",
    hardDesc: "Smaller targets, faster pace.",
    changeAnytime: "You can change this anytime.",
    continue: "Continue →",
  },

  exercises: {
    chooseToday: "Choose today's exercise.",
    tracingStart: "Start tracing",
    reachStart: "Start reaching",
    chooseHint: "Choose an exercise and how challenging it should feel.",
    tracingDesc: "",
    reachDesc: "",
    sessionLength: (n: number) => `A session is ${n} exercises of your chosen type.`,
    startSession: "Start session →",
  },

  /** Input-method picker on the setup screen: how the user drives the session. */
  inputMethod: {
    question: "How would you like to do the exercise?",
    hand: "Hand (webcam required)",
    mouse: "Mouse",
  },

  results: {
    sessionComplete: "Session complete",
    headline: "Nicely done, that's another one in the bank.",
    avgTimePerTarget: "Avg. time per target",
    pathEfficiency: "Path efficiency",
    backToExercises: "Back to exercises",
    thisSession: "This session",
    sessionCount: (n: number) => `${n} ${n === 1 ? "exercise" : "exercises"}`,
    exerciseLabel: (n: number) => `Exercise ${n}`,
    // Feedback sentences, keyed by exercise + metric + score tier.
    accTracingHigh: "Your line stayed close to the shape most of the way. Nice control.",
    accTracingMid: "You followed the shape well. A few small drifts — that's normal.",
    accReachHigh: "You reached the targets quickly and accurately. Great range.",
    accReachMid: "Solid reach and timing. Keep building on this.",
    smoothHigh: "Your movement was steady throughout — excellent control.",
    smoothMid: "Your movement was steady with a few small wobbles — that's expected.",
    smoothLow: "Your movements showed some variation today. This gets easier with practice.",
  },

  progress: {
    title: "Progress",
    filterAll: "All exercises",
    sessionScores: "Session scores",
    noSessionsTitle: "No sessions yet.",
    noSessionsBody: "Finish your first exercise to start seeing your progress here.",
    startExercise: "Start an exercise",
  },

  session: {
    modeDrawing: "Drawing",
    modeHovering: "Hovering",
    modePaused: "Paused",
    exitTitle: "End this exercise? Your progress is saved.",
    keepGoing: "Keep going",
    endNow: "End now",
    tracingHint: "Stay on the green path. If you stop, pinch near the line to continue.",
    clearDrawing: "Clear drawing",
    finishTracing: "Finish tracing",
    reachProgress: (done: number, total: number) => `${done} / ${total}`,
    reachedAll: (n: number) => `You reached all ${n} — nicely done.`,
    nicelyDone: "Nicely done.",
    seeResults: "See results",
    nextExercise: "Next exercise",
    exerciseProgress: (index: number, total: number) => `Exercise ${index} / ${total}`,
    exitAria: "Exit exercise",
  },

  /** Session cues. Which one shows is decided by the exercise's InstructionSpec
   *  (see exercises.ts) — the copy itself never leaves this dictionary. */
  instructions: {
    tracing: "Start at the green dot, then stay on the path.",
    lateralLeft: "Reach out to the target on your left, and hold steady.",
    lateralRight: "Reach out to the target on your right, and hold steady.",
    upward: "Reach up to the target, and hold steady.",
    moving: "Keep your fingertip on the moving target as it travels.",
    hold: (seconds: number) => `Hold steady inside the target for ${seconds} seconds.`,
    scatter: "Touch the targets as they appear, and hold each briefly.",
  },

  camera: {
    starting: "Starting camera…",
    noAccess: "This browser can't access the camera.",
    declined:
      "Camera access was declined. Allow the camera in your browser's site settings, then try again.",
    notFound: "No camera was found on this device.",
    inUse: "The camera seems to be in use by another app. Close it and try again.",
    failed: "The camera couldn't start.",
  },
} satisfies TranslationsShape;

/** The dictionary shape, derived from English so translations can't drift.
 *  `en` is not declared `as const`, so leaves stay `string` / `(n) => string`
 *  and each other language supplies its own text for the same keys. */
export type Translations = typeof en;

/**
 * A structural constraint used only to keep `en` honest (all leaves are strings
 * or `(…numbers) => string` functions). The real per-language guarantee comes
 * from `Translations = typeof en`, which every other dictionary must satisfy.
 */
type TranslationsShape = {
  [section: string]: {
    [key: string]: string | ((...args: number[]) => string);
  };
};

/* Georgian — must satisfy `Translations`, so any missing or misshaped key is a
   compile error. Phrasing aims for clear, natural Georgian for a rehab context;
   strings flagged for manual review are noted in the milestone write-up. */
export const ka: Translations = {
  nav: {
    home: "მთავარი",
    exercises: "ვარჯიშები",
    progress: "პროგრესი",
    settings: "პარამეტრები",
  },

  exerciseName: {
    tracing: "ფიგურების ხაზვა",
    reach: "სამიზნე",
  },

  metrics: {
    accuracy: "სიზუსტე",
    smoothness: "სიგლუვე",
  },

  common: {
    tryAgain: "თავიდან ცდა",
    recordingLocally: "შედეგები ინახება მხოლოდ თქვენს მოწყობილობაზე",
  },

  setup: {
    question: "აირჩიეთ დღევანდელი ვარჯიშის სირთულე",
    easyTitle: "მარტივი",
    easyDesc: "დიდი სამიზნეები, მეტი დრო.",
    mediumTitle: "საშუალო",
    mediumDesc: "დაბალანსებული ვარჯიში.",
    hardTitle: "რთული",
    hardDesc: "პატარა სამიზნეები, სწრაფი ტემპი.",
    changeAnytime: "ამის შეცვლა ნებისმიერ დროს შეგიძლიათ.",
    continue: "გაგრძელება →",
  },

  exercises: {
    chooseToday: "აირჩიეთ დღევანდელი ვარჯიში.",
    tracingStart: "ხაზვის დაწყება",
    reachStart: "მიწვდომის დაწყება",
    chooseHint: "აირჩიეთ ვარჯიში და მისი სირთულე.",
    tracingDesc: "",
    reachDesc: "",
    sessionLength: (n: number) => `სესია შედგება არჩეული ტიპის ${n} ვარჯიშისგან.`,
    startSession: "სესიის დაწყება →",
  },

  inputMethod: {
    question: "აირჩიეთ, როგორ გსურთ ვარჯიშის შესრულება",
    hand: "ხელით (საჭიროა ვებკამერა)",
    mouse: "მაუსით",
  },

  results: {
    sessionComplete: "სესია დასრულდა",
    headline: "ვარჯიში შესრულებულია",
    avgTimePerTarget: "საშ. დრო თითო სამიზნეზე",
    pathEfficiency: "ტრაექტორიის ეფექტურობა",
    backToExercises: "ვარჯიშებზე დაბრუნება",
    thisSession: "ეს სესია",
    sessionCount: (n: number) => `${n} ვარჯიში`,
    exerciseLabel: (n: number) => `ვარჯიში ${n}`,
    accTracingHigh: "თქვენი ხაზი უმეტესწილად ფიგურასთან ახლოს რჩებოდა. კარგი კონტროლი.",
    accTracingMid: "კარგად მიჰყევით ფიგურას. რამდენიმე მცირე გადახრა — ეს ნორმალურია.",
    accReachHigh: "სამიზნეებს სწრაფად და ზუსტად წვდებოდით. შესანიშნავი დიაპაზონი.",
    accReachMid: "კარგი წვდომა და დრო. განაგრძეთ ამ მიმართულებით.",
    smoothHigh: "თქვენი მოძრაობა მთელი ხნის განმავლობაში სტაბილური იყო — შესანიშნავი კონტროლი.",
    smoothMid: "თქვენი მოძრაობა სტაბილური იყო მცირე რყევებით — ეს მოსალოდნელია.",
    smoothLow: "დღეს თქვენს მოძრაობებში მცირე ცვალებადობა შეიმჩნეოდა. ვარჯიშით ეს გაადვილდება.",
  },

  progress: {
    title: "პროგრესი",
    filterAll: "ყველა ვარჯიში",
    sessionScores: "სესიის ქულები",
    noSessionsTitle: "სესიები ჯერ არ არის.",
    noSessionsBody: "დაასრულეთ პირველი ვარჯიში, რომ აქ თქვენი პროგრესი დაინახოთ.",
    startExercise: "ვარჯიშის დაწყება",
  },

  session: {
    modeDrawing: "ხაზვა",
    modeHovering: "თითის გაყოლება",
    modePaused: "პაუზა",
    exitTitle: "გსურთ ვარჯიშის დასრულება? თქვენი პროგრესი შენახულია.",
    keepGoing: "გაგრძელება",
    endNow: "დასრულება",
    tracingHint: "ხაზთან ახლოს შეაერთეთ საჩვენებელი და ცერა თითი, რომ დაიწყოთ ხაზვა",
    clearDrawing: "გასუფთავება",
    finishTracing: "ხაზვის დასრულება",
    reachProgress: (done: number, total: number) => `${done} / ${total} სამიზნე`,
    reachedAll: (n: number) => `${n} სამიზნე ✓`,
    nicelyDone: "ყოჩაღ.",
    seeResults: "შედეგების ნახვა",
    nextExercise: "შემდეგი ვარჯიში",
    exerciseProgress: (index: number, total: number) => `ვარჯიში ${index} / ${total}`,
    exitAria: "ვარჯიშიდან გასვლა",
  },

  instructions: {
    tracing: "დაიწყეთ მწვანე წერტილიდან და დარჩით ხაზზე.",
    lateralLeft: "მიუთითეთ სამიზნეზე",
    lateralRight: "მიუთითეთ სამიზნეზე",
    upward: "მიუთითეთ ეკრანზე გამოჩენილ სამიზნეებზე",
    moving: "შეინარჩუნეთ თითის წვერი მოძრავ სამიზნეზე",
    hold: (seconds: number) => `მიუთითეთ ეკრანზე გამოჩენილ სამიზნეზე ${seconds} წამით`,
    scatter: "მიუთითეთ სამიზნეებზე",
  },

  camera: {
    starting: "კამერა იტვირთება…",
    noAccess: "ამ ბრაუზერს კამერასთან წვდომა არ აქვს.",
    declined:
      "კამერასთან წვდომა უარყოფილია. დაუშვით კამერა ბრაუზერის საიტის პარამეტრებში და სცადეთ თავიდან.",
    notFound: "ამ მოწყობილობაზე კამერა ვერ მოიძებნა.",
    inUse: "როგორც ჩანს, კამერას სხვა აპლიკაცია იყენებს. დახურეთ ის და სცადეთ თავიდან.",
    failed: "კამერა ვერ ჩაირთო.",
  },
};

/* ─── language registry ───────────────────────────────────────────────────── */
/** Everything the UI needs to offer a language, in display order. Add a language
 *  by adding its dictionary above and one entry here. */
export const LANGUAGES: readonly { id: Language; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "ka", label: "ქართული" },
];

export const DICTS: Record<Language, Translations> = { en, ka };
