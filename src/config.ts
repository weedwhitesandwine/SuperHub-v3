/**
 * Dashboard configuration: schema, defaults, load/save, named profiles.
 * Stored at MyStyle/Plugins/SuperHub-v3/config.json (older MyStyle/Dashboard/ is a
 * read-only fallback). Read/written via the native reader/writer (fetch caches
 * file:// URLs → stale config; the SDK has no writeFile). The wizard writes it;
 * advanced users can hand-edit the same JSON.
 */
import {NativeModules} from 'react-native';

import {AppItem} from './apps';

const {DashboardNative} = NativeModules;

const CONFIG_PATH = '/storage/emulated/0/MyStyle/Plugins/SuperHub-v3/config.json';
/** A second copy written with every save, used when config.json is missing or unreadable
 *  (e.g. half-synced), so a bad read never starts the user from blank buttons. */
const BACKUP_PATH = '/storage/emulated/0/MyStyle/Plugins/SuperHub-v3/config.backup.json';

/** Max recent files a block can show. We rebuild the recent list ourselves from
 *  file mtime (the device's /Recent is out of scope on current firmware), so the
 *  old 8-item device cap no longer applies; this is just our own ceiling. */
export const RECENT_MAX = 20;
/** Default count for a new/blank recent block. */
export const RECENT_DEFAULT = 8;

/** The bubble is icon-only now (the house) or off. Older configs used 'label'/'hint';
 *  normalize() folds those into 'icon'. */
export type BubbleMode = 'icon' | 'off';

export type ShortcutItem =
  | {kind: 'folder'; label: string; path: string}
  | {kind: 'note-last'; label: string; path: string}
  | {kind: 'note-page'; label: string; path: string; page: number};

export type {AppItem};

/** Keyword zone rendering styles. */
export type KeywordDisplay = 'list' | 'inline' | 'byfolder';

/** Order of notes within a Stars/Keywords zone. */
export type NoteSort = 'recent' | 'name';

/** How a Stars zone previews each star's line: nothing / handwriting image / OCR text. */
export type LineMode = 'off' | 'image' | 'text';

/** Clock block display style. */
export type ClockStyle = 'large' | 'compact' | 'weekday' | 'jumbo' | 'mono' | 'stamp';

/** Week-number convention. iso = ISO-8601 (Mon start, wk1 has first Thursday);
 *  us = week 1 contains Jan 1, Sunday start. */
export type WeekNum = 'off' | 'iso' | 'us';

/** An extra clock face: a label + a whole/half-hour offset from the device's
 *  local time (the user dials it in with +/- buttons). */
export interface ClockExtra {
  label: string;
  offset: number; // hours relative to local time (may be fractional, e.g. 5.5)
}

/** Layout of items within a Shortcuts / Apps zone. */
export type ItemDisplay = 'list' | 'grid' | 'inline';

/** Fixed-mode block height (also the spacer's height). */
export type BlockHeight = 'S' | 'M' | 'L';

/** Fields common to every block: column, fixed-mode height, collapsed state. */
export interface ZoneCommon {
  /** 0-based column index (clamped to the layout's column count). Default 0. */
  col?: number;
  /** Height in 'fixed' vertical mode; also the spacer's height. Default 'M'. */
  h?: BlockHeight;
  /** Exact height in px, typed by the user; overrides the S/M/L preset when set
   *  (kept alongside `h` so clearing it falls back to the preset). */
  hpx?: number;
  /** Collapsed → only the title + an expand arrow show. */
  collapsed?: boolean;
  /** Full width: shown across all columns, above ('top') or below ('bottom') the
   *  column grid, in list order. Absent = a normal block in its column. */
  span?: 'top' | 'bottom';
}

/** Emoji per block type: used in the config canvas, the add menu, and (optionally)
 *  on the dashboard block titles. */
export const ZONE_ICONS: Record<string, string> = {
  shortcuts: '⧉',
  stars: '★',
  keywords: '#',
  apps: '▦',
  recent: '🗒️',
  clock: '🕑',
  search: '🔍',
  status: '🔋',
  nav: '🗂️',
  clips: '✂️',
  todo: '☑',
  toc: '≣',
  spacer: '▢',
  favourites: '♡',
};

/** Human label per block type: the SINGLE source for the block's default name,
 *  so the "＋ add block" menu, the config section name, and the dashboard title
 *  all read identically (e.g. status → "Device", nav → "Files"). */
export const ZONE_LABELS: Record<string, string> = {
  shortcuts: 'Shortcuts',
  stars: 'Stars',
  keywords: 'Keywords',
  apps: 'Apps',
  recent: 'Recent',
  clock: 'Clock',
  search: 'Search',
  status: 'Device',
  nav: 'Files',
  clips: 'Clips',
  todo: 'To-do',
  toc: 'Contents',
  spacer: 'Empty',
  favourites: 'Favourites',
};

/** Clip ordering in a Clips block. */
export type ClipSort = 'new' | 'old' | 'label' | 'note';
/** How a Clips block shows each clip: handwriting image, OCR text, or both.
 *  'ocr'/'both' need OCR enabled globally (Look → Note clips) so clips carry
 *  text; 'ocr' with no text falls back to the image. */
export type ClipTextMode = 'hand' | 'ocr' | 'both';

/** Optional grey/black rectangle drawn on the note around a captured clip. */
export type ClipFrame = 'off' | 'grey' | 'black';
/** How a captured clip is stored/pasted: keep the handwriting (image) or OCR it
 *  to text (pasted as an editable text box). OCR falls back to the image when it
 *  yields nothing, same as the Stars 'text' mode. */
export type ClipText = 'hand' | 'ocr';

export type Zone = ZoneCommon &
  (
    | {type: 'shortcuts'; title?: string; items: ShortcutItem[]; display?: ItemDisplay}
    | {type: 'stars'; title?: string; folders: string[]; noteSort?: NoteSort; lineMode?: LineMode; canDelete?: boolean; notesFolded?: boolean}
    | {
        type: 'keywords';
        title?: string;
        folders: string[];
        sort: 'keyword' | 'note';
        /** Which specific keywords to show (empty/absent = all). */
        keywords?: string[];
        display?: KeywordDisplay;
        noteSort?: NoteSort;
        /** Notebook groups start folded (tap a notebook to unfold it). */
        notesFolded?: boolean;
      }
    | {type: 'apps'; title?: string; apps: AppItem[]; display?: ItemDisplay}
    | {type: 'recent'; title?: string; count?: number; display?: ItemDisplay}
    | {type: 'clock'; title?: string; style?: ClockStyle; hour24?: boolean; locale?: string; showDate?: boolean; weekNum?: WeekNum; extras?: ClockExtra[]}
    | {type: 'search'; title?: string; folders?: string[]; searchTitles?: boolean; searchSd?: boolean}
    | {type: 'status'; title?: string; battery?: boolean; storage?: boolean; stats?: boolean}
    | {type: 'nav'; title?: string; root?: string}
    | {type: 'clips'; title?: string; folders?: string[]; labels?: string[]; display?: 'grid' | 'list'; sort?: ClipSort; size?: 'S' | 'M' | 'L'; textMode?: ClipTextMode}
    | {type: 'todo'; title?: string; folders?: string[]; labels?: string[]; display?: 'grid' | 'list'; sort?: ClipSort; size?: 'S' | 'M' | 'L'; textMode?: ClipTextMode}
    | {type: 'toc'; title?: string; indentByStyle?: boolean; titleLevels?: number[]}
    | {type: 'spacer'; title?: string}
    | {type: 'favourites'; title?: string; /** notes, documents and folders, in the order shown */ paths: string[]}
  );

export interface ScanSettings {
  /** Auto-rescan a zone when its cache is older than this many hours (0 = off).
   *  A zone that has never been scanned always auto-scans on first view. */
  autoRefreshHours: number;
  /** Rescan every time the dashboard opens. */
  autoOnOpen: boolean;
}

/** Visual style of the zones. grid/gridgray = thin hairline cells (black/grey);
 *  compact = dense, card = rounded filled card, minimal = no frame, underline =
 *  headline rule. */
export type Theme = 'ledger' | 'boxed' | 'airy' | 'grid' | 'gridgray' | 'compact' | 'card' | 'minimal' | 'underline';
export const THEMES: Theme[] = ['ledger', 'boxed', 'airy', 'grid', 'gridgray', 'compact', 'card', 'minimal', 'underline'];

/** How blocks flow down a column: natural height (masonry) or a set height that
 *  scrolls inside (fixed). */
export type VMode = 'masonry' | 'fixed';

/** Layout: 1-3 independent columns + the vertical flow mode. Replaces the old
 *  'stack' | 'grid' string (still read for migration). */
export interface LayoutConfig {
  columns: 1 | 2 | 3;
  vmode: VMode;
}

/** Pixel height per BlockHeight in 'fixed' mode / for spacers. */
export const BLOCK_HEIGHTS: Record<BlockHeight, number> = {S: 190, M: 300, L: 430};
/** Bounds for a hand-typed custom block height (px). Below the minimum a block
 *  would be invisible/untappable; the maximum is a few screens tall. */
export const MIN_BLOCK_PX = 20;
export const MAX_BLOCK_PX = 3000;
/** Largest custom corner radius (px) for block frames / dashboard buttons. */
export const MAX_CORNER = 30;

/** A block slot's height in px: the custom `hpx` when set and sane, else the
 *  S/M/L preset. Single source for the dashboard (fixed blocks + spacers). */
export function blockHeightPx(z: ZoneCommon): number {
  const px = z.hpx;
  if (typeof px === 'number' && px >= MIN_BLOCK_PX && px <= MAX_BLOCK_PX) return Math.round(px);
  return BLOCK_HEIGHTS[z.h ?? 'M'];
}

/** Dashboard text size (also enlarges tap targets). */
export type TextScale = 'S' | 'M' | 'L' | 'XL';

/** One round button in the Home layout's dock. 'block' opens one of the page's
 *  own blocks (the first of that type) on its own, full screen. */
export type DockItem = (
  /** An empty slot: shown as a faint "set up" placeholder until it is given a target. */
  | {kind: 'none'; label: string; glyph: string}
  | {kind: 'folder'; label: string; glyph: string; path: string}
  | {kind: 'note'; label: string; glyph: string; path: string}
  | {kind: 'app'; label: string; glyph: string; component: string; appLabel?: string}
  /** A dated planner: today's notebook <root>/<year>/<yyyy-mm-dd>.note on page 2, or <root>/<name> <year>.note when today has none. */
  | {kind: 'today'; label: string; glyph: string; root: string}
  /** Make a new notebook in `folder` (named like the Supernote does: YYYYMMDD_HHMMSS) and open it.
   *  `template` is a system template name or a template image path; `recognition` = real-time
   *  recognition notebook. doc = a typed document (.doc) in the Supernote's document editor instead. ask (default
   *  true) = show the New note screen to choose name, folder, style and recognition each time. */
  | {kind: 'create'; label: string; glyph: string; folder: string; template?: string; recognition?: boolean; doc?: boolean; landscape?: boolean; ask?: boolean}
  | {kind: 'block'; label: string; glyph: string; block: 'stars' | 'keywords' | 'favourites' | 'clips' | 'todo' | 'search' | 'recent' | 'settings'}
) & {
  /** The picture: a built-in icon name (assets/hub/icons, without .png) or the full path of the
   *  user's own PNG/JPG in MyStyle/SuperHub/Icons. */
  icon?: string;
};

/** The Home layout: big clock, a dock of round buttons, recent notes as page
 *  previews, then the normal blocks (Stars, Favourites, Keywords) underneath. */
export interface HomeConfig {
  /** 2 = the icon grid (two rows of five); older configs get the new default buttons. */
  v?: number;
  on: boolean;
  dock: DockItem[];
  /** How many recent page previews to show (0 hides the strip). */
  recent: number;
  hour24: boolean;
  /** Clock digits in bold instead of the thin face. */
  clockBold?: boolean;
  /** Show each console button's name beside it (false = buttons only). */
  labels?: boolean;
  /** What each of the Bookshelf page's three shelves shows: notes, docs, favourites or starred. */
  shelves?: string[];
}

// Plain text symbols only: emoji-style ones (♥ ✂ ✉) render as filled grey blobs on the Manta.
export const DOCK_GLYPHS = ['✎', '▤', '▦', '☑', '★', '☆', '♡', '#', '◆', '◇', '●', '○', '▲', '✦', '☰', '⌂'];

export const HOME_VERSION = 3;
/** SuperHub-v3 has exactly nine console buttons (see SLOT_NAMES in console.tsx). */
export const MAX_DOCK = 9;
const N = '/storage/emulated/0/Note';
export const DEFAULT_HOME: HomeConfig = {
  v: HOME_VERSION,
  on: true,
  recent: 0,
  hour24: true,
  clockBold: true,
  labels: true,
  shelves: ['notes', 'docs', 'favourites'],
  // D-pad up/left/right/down, left pill, right pill, B, A, speaker
  dock: [
    {kind: 'block', label: 'Favourites', glyph: '★', block: 'favourites'},
    {kind: 'block', label: 'Bookshelf', glyph: '▤', block: 'recent'},
    {kind: 'block', label: 'Starred', glyph: '☆', block: 'stars'},
    {kind: 'app', label: 'Digest', glyph: '◇', component: 'com.ratta.supernote.knowledge/com.ratta.supernote.knowledge.activity.KnowledgeActivity'},
    {kind: 'block', label: 'Settings', glyph: '⚙', block: 'settings'},
    {kind: 'block', label: 'Search', glyph: '○', block: 'search'},
    {kind: 'folder', label: 'Notes', glyph: '✎', path: N},
    {kind: 'create', label: 'New note', glyph: '+', folder: N},
    {kind: 'app', label: 'Calendar', glyph: '▦', component: 'com.ratta.supernote.calendar/com.ratta.supernote.calendar.MainActivity'},
  ],
};

/** The blocks shown under the Home layout's dock and recent strip. */
export const HOME_ZONES: Zone[] = [
  {type: 'stars', title: 'Stars', folders: ['/storage/emulated/0/Note'], col: 0},
  {type: 'favourites', title: 'Favourites', paths: [], col: 1},
  {type: 'keywords', title: 'Keywords', folders: ['/storage/emulated/0/Note'], sort: 'keyword', display: 'inline', span: 'bottom'},
];

export interface DashboardConfig {
  /** Home layout (clock + dock + recent previews above the blocks). */
  home: HomeConfig;
  bubble: {mode: BubbleMode};
  scan: ScanSettings;
  theme: Theme;
  layout: LayoutConfig;
  textScale: TextScale;
  /** Zone-title size, independent from the content text ('S' = the historical look). */
  headingScale: TextScale;
  /** A MyStyle/fonts .ttf/.otf path to use for dashboard text; '' / undefined = system default. */
  font?: string;
  /** Show each block's type icon on its dashboard title. */
  showIcons?: boolean;
  /** Corner radius (px) of block frames and dashboard buttons, 0 = square.
   *  undefined = the design's own rounding. */
  corners?: number;
  /** Rectangle drawn on the note around a lassoed clip (off by default). */
  clipFrame?: ClipFrame;
  /** Capture clips as handwriting (image, default) or OCR them to text. */
  clipText?: ClipText;
  /** Font size (px) for an OCR'd clip pasted as a text box. */
  clipFontSize?: number;
  /** Add a "↩ source" link under a pasted clip. Off = paste the bare image. */
  clipBacklink?: boolean;
  /** MyStyle/fonts .ttf/.otf path for an OCR'd clip pasted as a text box; '' / undefined = the note's default font. */
  clipFontPath?: string;
  /** Write the debug log to MyStyle/Plugins/SuperHub-v3/SuperHub-v3_log.txt (off by default). */
  debugLog?: boolean;
  zones: Zone[];
}

export const DEFAULT_CONFIG: DashboardConfig = {
  home: DEFAULT_HOME,
  bubble: {mode: 'icon'},
  scan: {autoRefreshHours: 24, autoOnOpen: false},
  theme: 'underline',
  layout: {columns: 2, vmode: 'masonry'},
  textScale: 'M',
  headingScale: 'S',
  zones: HOME_ZONES,
};

/** The plugin's original block-only starting page (kept for reference). */
export const CLASSIC_ZONES: Zone[] = [
    {
      type: 'shortcuts',
      title: 'Shortcuts',
      items: [{kind: 'folder', label: 'Notes', path: '/storage/emulated/0/Note'}],
    },
    {type: 'recent', title: 'Recent', count: 8, display: 'list'},
    {type: 'stars', title: 'Stars', folders: ['/storage/emulated/0/Note']},
    {
      type: 'keywords',
      title: 'Keywords',
      folders: ['/storage/emulated/0/Note'],
      sort: 'keyword',
    },
    {
      type: 'apps',
      title: 'Apps',
      apps: [
        {label: 'ToDo', component: 'com.ratta.supernote.task/com.ratta.supernote.task.TaskActivity'},
        {label: 'Calendar', component: 'com.ratta.supernote.calendar/com.ratta.supernote.calendar.MainActivity'},
      ],
    },
];

/** Load config from disk, falling back to DEFAULT_CONFIG if missing/invalid.
 *  Uses the native reader (not fetch, which caches file:// → stale config after a Save). */
async function readJson(path: string): Promise<string | null> {
  try {
    const text: string = await DashboardNative.readTextFile(path);
    return text && text.trim() ? text : null;
  } catch {
    return null;
  }
}

/** Whether a config has ever been saved to disk. False on first open, where
 *  loadConfig() would return DEFAULT_CONFIG; the two are indistinguishable
 *  from the config object alone. */
export async function hasSavedConfig(): Promise<boolean> {
  return (
    (await readJson(CONFIG_PATH)) != null
  );
}

/** Tell the native logger whether to write the log file (logcat always gets it). */
function applyLogSetting(cfg: DashboardConfig): void {
  try {
    DashboardNative?.setFileLog?.(cfg.debugLog === true).catch(() => {});
  } catch {}
}

export async function loadConfig(): Promise<DashboardConfig> {
  let text = await readJson(CONFIG_PATH);
  try {
    if (text) JSON.parse(text);
  } catch {
    text = null;
  }
  if (!text) text = await readJson(BACKUP_PATH);
  let cfg = DEFAULT_CONFIG;
  if (text) {
    try {
      const raw = JSON.parse(text);
      cfg = normalize(raw);
      // First open after the Home layout arrived: keep the old page as a profile
      // (Save/load config can bring it back), then switch to Home.
      if (!raw?.home) {
        try {
          await saveProfile('Before Home layout', cfg);
        } catch {}
        cfg = {...cfg, home: DEFAULT_HOME, theme: 'underline', layout: {columns: 2, vmode: 'masonry'}, textScale: 'M', zones: HOME_ZONES};
        await saveConfig(cfg);
      }
    } catch {}
  }
  applyLogSetting(cfg);
  return cfg;
}

/** Persist config to disk. Returns true on success. */
export async function saveConfig(cfg: DashboardConfig): Promise<boolean> {
  try {
    const json = JSON.stringify(cfg, null, 2);
    await DashboardNative.writeFile(CONFIG_PATH, json);
    DashboardNative.writeFile(BACKUP_PATH, json).catch(() => {});
    applyLogSetting(cfg);
    return true;
  } catch {
    return false;
  }
}

/** Migrate/validate the layout. Accepts the new object shape AND the retired
 *  'stack'/'grid' strings so old (and other users') configs keep working. */
function normalizeLayout(raw: any): LayoutConfig {
  if (raw === 'grid') return {columns: 2, vmode: 'masonry'};
  if (raw === 'stack') return {columns: 1, vmode: 'masonry'};
  if (raw && typeof raw === 'object') {
    const columns: 1 | 2 | 3 = raw.columns === 2 ? 2 : raw.columns === 3 ? 3 : 1;
    const vmode: VMode = raw.vmode === 'fixed' ? 'fixed' : 'masonry';
    return {columns, vmode};
  }
  return {columns: 1, vmode: 'masonry'};
}

/** Shallow validation so a malformed field can't crash the dashboard. */
function normalize(raw: any): DashboardConfig {
  // Fallbacks come from DEFAULT_CONFIG so each default has one owner.
  // Only 'off' or 'icon' now; fold the retired 'label'/'hint' (and anything else) into 'icon'.
  const mode: BubbleMode = raw?.bubble?.mode === 'off' ? 'off' : 'icon';
  const layout = normalizeLayout(raw?.layout);
  // Old 2-column ('grid') configs auto-split zones even/odd; reproduce that as a
  // round-robin column assignment so a pre-update config keeps its 2-column look.
  const legacyGrid = raw?.layout === 'grid';
  const hasZones = Array.isArray(raw?.zones);
  const rawZones: any[] = hasZones ? raw.zones.filter(isZone) : (DEFAULT_CONFIG.zones as any[]);
  const zones: Zone[] = rawZones.map((z: any, i: number) => {
    if (z.type === 'shortcuts' && z.title === 'Favourites' && !(Array.isArray(z.items) && z.items.length)) z = {type: 'favourites', title: z.title, paths: [], col: z.col, span: z.span};
    const nz: any = normalizeZone(z);
    const rawCol = typeof z.col === 'number' ? z.col : legacyGrid ? i % 2 : 0;
    nz.col = Math.max(0, Math.min(layout.columns - 1, rawCol));
    nz.h = ['S', 'M', 'L'].includes(z.h) ? z.h : 'M';
    // Custom px height: kept only when it's a sane number, so a hand-edited or
    // half-typed value can never render a 0-high (invisible) block.
    const hpx = typeof z.hpx === 'number' ? Math.round(z.hpx) : NaN;
    if (hpx >= MIN_BLOCK_PX && hpx <= MAX_BLOCK_PX) nz.hpx = hpx;
    else delete nz.hpx;
    if (z.span === 'top' || z.span === 'bottom') nz.span = z.span;
    else delete nz.span;
    return nz as Zone;
  });
  const scan: ScanSettings = {
    autoRefreshHours:
      typeof raw?.scan?.autoRefreshHours === 'number'
        ? raw.scan.autoRefreshHours
        : DEFAULT_CONFIG.scan.autoRefreshHours,
    autoOnOpen: raw?.scan?.autoOnOpen === true,
  };
  const theme: Theme = THEMES.includes(raw?.theme) ? raw.theme : DEFAULT_CONFIG.theme;
  const textScale: TextScale = ['S', 'M', 'L', 'XL'].includes(raw?.textScale)
    ? raw.textScale
    : DEFAULT_CONFIG.textScale;
  const headingScale: TextScale = ['S', 'M', 'L', 'XL'].includes(raw?.headingScale)
    ? raw.headingScale
    : DEFAULT_CONFIG.headingScale;
  const font: string | undefined = typeof raw?.font === 'string' && raw.font ? raw.font : undefined;
  const showIcons = raw?.showIcons === true;
  const clipFrame: ClipFrame = ['off', 'grey', 'black'].includes(raw?.clipFrame) ? raw.clipFrame : 'off';
  const clipText: ClipText = raw?.clipText === 'ocr' ? 'ocr' : 'hand';
  // The pasted text box is now sized snugly to the text, so clipFontSize IS the
  // size that renders (WYSIWYG). It used to be ~1/3 of it: the old oversized box
  // made the firmware re-fit any 28/36/48 choice up to ~96 on the first relayout.
  // Migrate those legacy values to the size they actually produced.
  const rawSize = typeof raw?.clipFontSize === 'number' ? raw.clipFontSize : 96;
  const clipFontSize: number = rawSize <= 48 ? 96 : Math.min(220, rawSize);
  const clipFontPath: string | undefined = typeof raw?.clipFontPath === 'string' && raw.clipFontPath ? raw.clipFontPath : undefined;
  const clipBacklink: boolean = raw?.clipBacklink !== false; // default on
  const debugLog: boolean = raw?.debugLog === true; // default off
  const corners: number | undefined =
    typeof raw?.corners === 'number' && isFinite(raw.corners) ? Math.max(0, Math.min(MAX_CORNER, Math.round(raw.corners))) : undefined;

  return {home: normalizeHome(raw?.home), bubble: {mode}, scan, theme, layout, textScale, headingScale, font, showIcons, corners, clipFrame, clipText, clipFontSize, clipFontPath, clipBacklink, debugLog, zones};
}

function normalizeHome(h: any): HomeConfig {
  if (!h || typeof h !== 'object') return DEFAULT_HOME;
  const str = (v: any) => (typeof v === 'string' ? v : '');
  // Configs from before the icon grid get the new buttons; their other home settings are kept.
  const src = h.v === HOME_VERSION && Array.isArray(h.dock) ? h.dock : DEFAULT_HOME.dock;
  const dock: DockItem[] = src
    .filter((d: any) => d && ['none', 'folder', 'note', 'app', 'block', 'today', 'create'].includes(d.kind))
    .map((d: any) => ({...d, label: str(d.label), glyph: ({'♥': '♡', '✂': '◇', '✉': '☰'} as any)[str(d.glyph)] ?? (str(d.glyph) || '●')}))
    .slice(0, MAX_DOCK);
  while (dock.length < MAX_DOCK) dock.push({kind: 'none', label: '', glyph: '+'});
  return {
    v: HOME_VERSION,
    on: h.on !== false,
    dock,
    recent: typeof h.recent === 'number' ? Math.max(0, Math.min(8, Math.round(h.recent))) : DEFAULT_HOME.recent,
    hour24: h.hour24 !== false,
    clockBold: h.clockBold === true,
    labels: h.labels !== false,
    // always three shelves; each shows notes, docs, favourites or starred pages
    shelves: [0, 1, 2].map(i => (Array.isArray(h.shelves) && ['notes', 'docs', 'favourites', 'starred'].includes(h.shelves[i]) ? h.shelves[i] : ['notes', 'docs', 'favourites'][i])),
  };
}

function isZone(z: any): z is Zone {
  return z && ['shortcuts', 'stars', 'keywords', 'apps', 'recent', 'clock', 'search', 'status', 'nav', 'clips', 'todo', 'toc', 'spacer', 'favourites'].includes(z.type);
}

/** A default block for a home button whose block isn't on the page yet. */
export function newZone(block: string): Zone | null {
  const titles: Record<string, string> = {keywords: 'Keywords', search: 'Search', clips: 'Note Clips', todo: 'To-do', stars: 'Stars', favourites: 'Favourites'};
  if (!titles[block]) return null;
  return normalizeZone({type: block, title: titles[block], folders: [], col: 0, ...(block === 'keywords' ? {folders: ['/storage/emulated/0/Note'], sort: 'keyword', display: 'inline'} : {})});
}

/** Guarantee a zone's required arrays/fields exist so a hand-edited config
 *  (the docs invite it) can't crash rendering. */
function normalizeZone(z: any): Zone {
  const arr = (v: any) => (Array.isArray(v) ? v : []);
  switch (z.type) {
    case 'shortcuts':
      return {...z, items: arr(z.items)};
    case 'stars':
      return {...z, folders: arr(z.folders)};
    case 'keywords':
      return {...z, folders: arr(z.folders), sort: z.sort === 'note' ? 'note' : 'keyword'};
    case 'apps':
      return {...z, apps: arr(z.apps)};
    case 'recent':
      // Clamp to [1, RECENT_MAX]; fall back to RECENT_DEFAULT when unset.
      return {...z, count: Math.min(RECENT_MAX, Math.max(1, typeof z.count === 'number' ? z.count : RECENT_DEFAULT))};
    case 'clock': {
      const extras: ClockExtra[] = Array.isArray(z.extras)
        ? z.extras
            .filter((e: any) => e && typeof e.offset === 'number')
            .map((e: any) => ({label: typeof e.label === 'string' ? e.label : '', offset: e.offset}))
            .slice(0, 6)
        : [];
      return {
        ...z,
        style: ['large', 'compact', 'weekday', 'jumbo', 'mono', 'stamp'].includes(z.style) ? z.style : 'large',
        hour24: z.hour24 !== false, // default: 24-hour
        showDate: z.showDate !== false, // default: show the date
        weekNum: ['iso', 'us'].includes(z.weekNum) ? z.weekNum : 'off',
        extras,
      };
    }
    case 'search':
      return {...z, folders: arr(z.folders), searchTitles: !!z.searchTitles, searchSd: !!z.searchSd}; // empty folders = whole device
    case 'status':
    case 'nav':
      return {...z};
    case 'clips':
    case 'todo':
      return {
        ...z,
        folders: arr(z.folders),
        labels: arr(z.labels),
        sort: ['new', 'old', 'label', 'note'].includes(z.sort) ? z.sort : 'new',
        size: ['S', 'M', 'L'].includes(z.size) ? z.size : 'M',
        textMode: ['hand', 'ocr', 'both'].includes(z.textMode) ? z.textMode : 'hand',
      };
    case 'toc': {
      // titleLevels maps each of the 4 title styles (index = style-1) to an indent
      // level 1..4; default identity. Kept length-4 and clamped so a hand-edited
      // config can't break the indent math.
      const tl =
        Array.isArray(z.titleLevels) && z.titleLevels.length === 4
          ? z.titleLevels.map((n: any) => Math.min(4, Math.max(1, typeof n === 'number' ? n : 1)))
          : [1, 2, 3, 4];
      return {...z, indentByStyle: !!z.indentByStyle, titleLevels: tl};
    }
    case 'favourites':
      return {...z, paths: arr(z.paths).filter((x: any) => typeof x === 'string')};
    case 'spacer':
      return {...z}; // empty block; height comes from `h` (set in normalize)
    default:
      return z;
  }
}

// ---- Named config profiles (save / reload; guards against accidental reset) --
const PROFILES_PATH = '/storage/emulated/0/MyStyle/Plugins/SuperHub-v3/profiles.json';

async function readProfiles(): Promise<Record<string, DashboardConfig>> {
  try {
    const text = await readJson(PROFILES_PATH);
    if (text) return JSON.parse(text).profiles ?? {};
  } catch {
    /* none yet / malformed */
  }
  return {};
}
async function writeProfiles(p: Record<string, DashboardConfig>): Promise<void> {
  await DashboardNative.writeFile(PROFILES_PATH, JSON.stringify({profiles: p}, null, 2));
}

export async function listProfiles(): Promise<string[]> {
  return Object.keys(await readProfiles()).sort((a, b) => a.localeCompare(b));
}
export async function saveProfile(name: string, cfg: DashboardConfig): Promise<void> {
  const p = await readProfiles();
  p[name.trim()] = cfg;
  await writeProfiles(p);
}
export async function loadProfile(name: string): Promise<DashboardConfig | null> {
  const p = await readProfiles();
  return p[name] ? normalize(p[name]) : null;
}
export async function deleteProfile(name: string): Promise<void> {
  const p = await readProfiles();
  delete p[name];
  await writeProfiles(p);
}
