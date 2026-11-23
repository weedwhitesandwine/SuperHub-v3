/**
 * Home layout: a big clock (date, week, battery), a dock of round buttons and
 * the most recent notes as page previews. The page's normal blocks (Stars,
 * Favourites, Keywords...) render underneath it in App.tsx. Greyscale only.
 */
import React, {useEffect, useState} from 'react';
import {DeviceEventEmitter, Image, NativeModules, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {PluginFileAPI} from 'sn-plugin-lib';

import {DockItem, HomeConfig} from './config';
import {readRecent} from './recent';
import {createDoc, createNote, openFile, openFolder, launchApp} from './open';
import {noteTitle, recentModifiedFiles, scanStars} from './scanner';
import {cacheDir} from './paths';
import {setRoute} from './route';
import {ICONS} from './icons';

/** Where people drop their own button pictures (PNG/JPG). */
export const USER_ICON_DIR = '/storage/emulated/0/MyStyle/SuperHub-v3/Icons';

const TILE = '#ececec'; // the soft grey behind each icon and header button
const HAIR = '#c8c8c8'; // thin card and page borders

const {DashboardNative} = NativeModules;
const INK = '#000000';
const GREY = '#6b6b6b';

function log(m: string) {
  DashboardNative?.appendLog?.(`[home] ${m}`).catch(() => {});
}

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---- Clock ----------------------------------------------------------------
export function HomeClock({hour24, nonce, font, bold, onDay}: {hour24: boolean; nonce: number; font?: string; bold?: boolean; onDay?: (d: Date) => void}) {
  const [now, setNow] = useState(() => new Date());
  const [bat, setBat] = useState<{level: number; charging: boolean} | null>(null);
  useEffect(() => {
    setNow(new Date());
    // e-ink: repaint once a minute, on the minute
    let iv: ReturnType<typeof setInterval> | undefined;
    const to = setTimeout(() => {
      setNow(new Date());
      iv = setInterval(() => setNow(new Date()), 60000);
    }, 60000 - (Date.now() % 60000));
    DashboardNative?.getBattery?.().then(setBat).catch(() => {});
    return () => {
      clearTimeout(to);
      if (iv) clearInterval(iv);
    };
  }, [nonce]);
  const ff = font ? {fontFamily: font} : null;
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  let ampm = '';
  if (!hour24) {
    ampm = h < 12 ? ' am' : ' pm';
    h = h % 12 || 12;
  }
  const time = `${hour24 ? String(h).padStart(2, '0') : h}:${m}`;
  const meta = [`Week ${isoWeek(now)}`, bat && bat.level >= 0 ? `Battery ${bat.level}%${bat.charging ? ' ⚡' : ''}` : null]
    .filter(Boolean)
    .join('   ·   ');
  return (
    <View style={{marginHorizontal: 26, marginTop: 14, borderWidth: 1.5, borderColor: HAIR, borderRadius: 28, paddingVertical: 24, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center'}}>
      <View style={{flex: 1}}>
        <Text style={[{fontSize: 140, fontWeight: bold ? '600' : '200', color: INK, letterSpacing: bold ? -2 : -5, lineHeight: 150}, ff]}>
          {time}
          {ampm ? <Text style={{fontSize: 36}}>{ampm}</Text> : null}
        </Text>
        <Text style={[{fontSize: 27, fontWeight: '300', color: INK, marginTop: 2}, ff]}>
          {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
        </Text>
        <Text style={[{fontSize: 15, color: GREY, marginTop: 10, letterSpacing: 2}, ff]}>{meta.toUpperCase()}</Text>
      </View>
      <View style={{width: 1.5, alignSelf: 'stretch', backgroundColor: '#dddddd', marginHorizontal: 22}} />
      <MonthGrid now={now} font={font} onDay={onDay} />
    </View>
  );
}

/** This month as a small calendar: weeks Monday to Sunday, today as a black circle,
 *  weekends grey. Tapping a day calls onDay (the home screen opens that day's notebook). */
function MonthGrid({now, font, onDay}: {now: Date; font?: string; onDay?: (d: Date) => void}) {
  const ff = font ? {fontFamily: font} : null;
  const y = now.getFullYear();
  const m = now.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({length: days}, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({length: cells.length / 7}, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const cell = 40;
  return (
    <View style={{width: cell * 7}}>
      <Text style={[{fontSize: 20, fontWeight: '500', color: INK, marginBottom: 6, marginLeft: 4}, ff]}>{MONTHS[m]}</Text>
      <View style={{flexDirection: 'row'}}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
          <Text key={i} style={[{width: cell, textAlign: 'center', fontSize: 13, fontWeight: '500', color: GREY, marginBottom: 4}, ff]}>
            {l}
          </Text>
        ))}
      </View>
      {weeks.map((wk, w) => (
        <View key={w} style={{flexDirection: 'row'}}>
          {wk.map((d, i) => {
            const today = d === now.getDate();
            return (
              <TouchableOpacity
                key={i}
                disabled={!d || !onDay}
                onPress={() => d && onDay?.(new Date(y, m, d))}
                style={{width: cell, height: cell, alignItems: 'center', justifyContent: 'center'}}>
                {d ? (
                  <View style={{width: cell - 6, height: cell - 6, borderRadius: cell, backgroundColor: today ? INK : 'transparent', alignItems: 'center', justifyContent: 'center'}}>
                    <Text style={[{fontSize: 17, color: today ? '#ffffff' : i > 4 ? GREY : INK}, ff]}>{d}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---- Icon grid -------------------------------------------------------------
/** Today's notebook in a folder of dated notebooks (<root>/YYYY/YYYY-MM-DD.note), on page 2;
 *  else <root>/<folder name> YYYY.note; else the folder itself. */
export async function openToday(root: string, d: Date = new Date()) {
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const day = `${root}/${d.getFullYear()}/${ymd}.note`;
  const ok = await DashboardNative?.fileExists?.(day).catch(() => false);
  if (ok) return openFile(day, 2);
  const hub = `${root}/${root.substring(root.lastIndexOf('/') + 1)} ${d.getFullYear()}.note`;
  if (await DashboardNative?.fileExists?.(hub).catch(() => false)) return openFile(hub, 1);
  return openFolder(root);
}

export function pressDock(d: DockItem, onBlock: (b: string) => void, onNewNote?: (d: Extract<DockItem, {kind: 'create'}>) => void) {
  if (d.kind === 'none') setRoute('config');
  else if (d.kind === 'folder') openFolder(d.path);
  else if (d.kind === 'note') void openFile(d.path, 0);
  else if (d.kind === 'app') launchApp(d.component);
  else if (d.kind === 'today') void openToday(d.root);
  else if (d.kind === 'create' && d.doc) void createDoc(d.folder);
  else if (d.kind === 'create' && d.ask !== false && onNewNote) onNewNote(d);
  else if (d.kind === 'create') void createNote(d.folder, d.template, d.recognition, undefined, d.landscape);
  else onBlock(d.block);
}

/** A button's picture: its sketch icon, or the old round glyph when it has none. */
export function DockPicture({d, size}: {d: DockItem; size: number}) {
  const src = d.icon ? (d.icon.startsWith('/') ? {uri: 'file://' + d.icon} : ICONS[d.icon]) : undefined;
  const tile = {width: size, height: size, borderRadius: size * 0.28, alignItems: 'center' as const, justifyContent: 'center' as const};
  if (!src && d.kind === 'none')
    return (
      <View style={[tile, {borderWidth: 2, borderStyle: 'dashed', borderColor: '#b0b0b0'}]}>
        <Text style={{fontSize: size * 0.34, color: '#9a9a9a', fontWeight: '200'}}>+</Text>
      </View>
    );
  // built-in icons are line glyphs on a soft tile; people's own pictures fill the tile
  if (src)
    return (
      <View style={[tile, {backgroundColor: TILE, overflow: 'hidden'}]}>
        <Image source={src} style={d.icon?.startsWith('/') ? {width: size, height: size} : {width: size * 0.5, height: size * 0.5}} resizeMode={d.icon?.startsWith('/') ? 'cover' : 'contain'} fadeDuration={0} />
      </View>
    );
  return (
    <View style={[tile, {backgroundColor: TILE}]}>
      <Text style={{fontSize: size * 0.34, color: INK}}>{d.glyph}</Text>
    </View>
  );
}

/** The home buttons: rows of five icon tiles with their names. */
export function Dock({items, onBlock, onNewNote, font}: {items: DockItem[]; onBlock: (b: string) => void; onNewNote?: (d: Extract<DockItem, {kind: 'create'}>) => void; font?: string}) {
  const ff = font ? {fontFamily: font} : null;
  return (
    <View style={{flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20}}>
      {items.map((d, i) => (
        <TouchableOpacity key={i} onPress={() => pressDock(d, onBlock, onNewNote)} style={{width: '20%', alignItems: 'center', paddingVertical: 14}}>
          <DockPicture d={d} size={116} />
          <Text style={[{fontSize: 18, fontWeight: '400', color: '#222222', marginTop: 12}, ff]} numberOfLines={1}>
            {d.label || (d.kind === 'none' ? 'Set up' : '')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ---- Recent page previews ---------------------------------------------------
interface Thumb {
  path: string;
  mtime: number;
  png?: string;
}

function hashPath(p: string): string {
  let h = 0;
  for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function unwrap<T>(r: any): T | undefined {
  if (r && typeof r === 'object' && 'success' in r) return r.success ? (r.result as T) : undefined;
  return r as T;
}

async function mtimeOf(path: string): Promise<number> {
  try {
    const dir = path.substring(0, path.lastIndexOf('/'));
    const list: any[] = (await DashboardNative.listDir(dir)) ?? [];
    return list.find(e => e.path === path)?.mtime ?? 0;
  } catch {
    return 0;
  }
}

/** PNG of one page of a note (0-based; -1 = last page), cached by path + page +
 *  modified time. Older PNGs of the same page are pruned. */
async function pagePreview(path: string, mtime: number, page0 = -1): Promise<string | undefined> {
  if (!/\.note$/i.test(path)) return undefined;
  try {
    const dir = await cacheDir();
    const stem = `thumb_${hashPath(path)}_${page0 < 0 ? 'L' : 'p' + page0}_`;
    const png = `${dir}${stem}${Math.round(mtime)}.png`;
    if (await DashboardNative?.fileExists?.(png)) return png;
    let page = page0;
    if (page < 0) {
      const total = unwrap<number>(await PluginFileAPI.getNoteTotalPageNum(path)) ?? 1;
      page = Math.max(0, total - 1);
    }
    const r: any = await PluginFileAPI.generateNotePng({notePath: path, page, times: 1, pngPath: png, type: 1});
    if (!(r === true || r?.success)) {
      log(`preview failed ${path}: ${JSON.stringify(r?.error ?? r)}`);
      return undefined;
    }
    DashboardNative?.pruneMatching?.(dir, stem, png.substring(png.lastIndexOf('/') + 1)).catch(() => {});
    return png;
  } catch (e: any) {
    log(`preview error ${path}: ${e?.message}`);
    return undefined;
  }
}

function ago(ms: number): string {
  if (!ms) return '';
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 2) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function RecentStrip({count, nonce, font}: {count: number; nonce: number; font?: string}) {
  const [items, setItems] = useState<Thumb[] | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('dashboard_refresh_all', () => setTick(t => t + 1));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      const paths = (await readRecent()).slice(0, count);
      const base: Thumb[] = await Promise.all(paths.map(async p => ({path: p, mtime: await mtimeOf(p)})));
      if (!alive) return;
      setItems(prev => base.map(b => ({...b, png: prev?.find(x => x.path === b.path && x.mtime === b.mtime)?.png})));
      // one at a time: rendering pages is heavy on the tablet
      for (let i = 0; i < base.length; i++) {
        const png = await pagePreview(base[i].path, base[i].mtime);
        if (!alive) return;
        if (png) setItems(cur => (cur ? cur.map(x => (x.path === base[i].path ? {...x, png} : x)) : cur));
      }
    })();
    return () => {
      alive = false;
    };
  }, [count, nonce, tick]);
  if (count <= 0) return null;
  const ff = font ? {fontFamily: font} : null;
  return (
    <View style={{marginBottom: 30, paddingHorizontal: 30}}>
      <Text style={[{fontSize: 14, fontWeight: '500', letterSpacing: 3, color: GREY, marginBottom: 14, marginLeft: 2}, ff]}>RECENT</Text>
      {items === null && <Text style={{color: GREY, fontSize: 15, marginLeft: 4}}>loading…</Text>}
      {items && items.length === 0 && <Text style={{color: GREY, fontSize: 15, marginLeft: 4}}>No recent notes.</Text>}
      <View style={{flexDirection: 'row'}}>
        {(items ?? []).map((t, i) => (
          <TouchableOpacity key={t.path} style={{flex: 1, marginLeft: i ? 14 : 0, maxWidth: `${100 / count}%`}} onPress={() => openFile(t.path, 0)}>
            <View style={{aspectRatio: 0.75, borderWidth: 1, borderColor: HAIR, borderRadius: 16, overflow: 'hidden', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center'}}>
              {t.png ? (
                <Image source={{uri: 'file://' + t.png}} style={{width: '100%', height: '100%'}} resizeMode="cover" resizeMethod="resize" fadeDuration={0} />
              ) : (
                <Text style={{fontSize: 34, color: '#9a9a9a', fontWeight: '300'}}>{/\.pdf$/i.test(t.path) ? 'PDF' : /\.epub$/i.test(t.path) ? 'EPUB' : '…'}</Text>
              )}
            </View>
            <Text style={[{fontSize: 15, fontWeight: '500', color: INK, marginTop: 10}, ff]} numberOfLines={1}>
              {noteTitle(t.path)}
            </Text>
            <Text style={[{fontSize: 13, color: GREY, marginTop: 1}, ff]} numberOfLines={1}>
              {ago(t.mtime)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const isFolder = (p: string) => !/\.[a-z0-9]{2,5}$/i.test(p);
export function openPath(p: string) {
  if (isFolder(p)) openFolder(p);
  else void openFile(p, 0);
}

// ---- Full-screen grids: starred pages / favourites -------------------------
interface Card {
  key: string;
  path: string;
  page0: number; // -1 = last page
  title: string;
  sub: string;
  png?: string;
  mtime: number;
  onPress: () => void;
}

function CardGrid({cards, font, empty, s = 1}: {cards: Card[] | null; font?: string; empty: string; s?: number}) {
  const ff = font ? {fontFamily: font} : null;
  if (cards === null) return <Text style={{color: GREY, fontSize: 17 * s, margin: 8}}>loading…</Text>;
  if (cards.length === 0) return <Text style={{color: GREY, fontSize: 17 * s, margin: 8}}>{empty}</Text>;
  return (
    <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
      {cards.map(c => (
        <TouchableOpacity key={c.key} style={{width: '33.33%', padding: 8, marginBottom: 6}} onPress={c.onPress}>
          <View style={{aspectRatio: 0.75, borderWidth: 1.5, borderColor: INK, borderRadius: 6, overflow: 'hidden', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center'}}>
            {c.png ? (
              <Image source={{uri: 'file://' + c.png}} style={{width: '100%', height: '100%'}} resizeMode="cover" resizeMethod="resize" fadeDuration={0} />
            ) : (
              <Text style={{fontSize: 34, color: '#9a9a9a'}}>{isFolder(c.path) ? '▤' : /\.pdf$/i.test(c.path) ? 'PDF' : /\.epub$/i.test(c.path) ? 'EPUB' : '…'}</Text>
            )}
          </View>
          <Text style={[{fontSize: 17 * s, fontWeight: '700', color: INK, marginTop: 7}, ff]} numberOfLines={2}>
            {c.title}
          </Text>
          <Text style={[{fontSize: 14 * s, color: GREY}, ff]} numberOfLines={1}>
            {c.sub}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Fill in each card's preview, one page at a time (rendering is heavy). */
function usePreviews(cards: Card[] | null, setCards: (f: (c: Card[] | null) => Card[] | null) => void, alive: () => boolean) {
  useEffect(() => {
    if (!cards) return;
    (async () => {
      for (const c of cards) {
        if (c.png || !alive()) continue;
        const png = await pagePreview(c.path, c.mtime, c.page0);
        if (!alive()) return;
        if (png) setCards(cur => (cur ? cur.map(x => (x.key === c.key ? {...x, png} : x)) : cur));
      }
    })();
    // run once per fresh card list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards?.map(c => c.key).join('|')]);
}

function PageHeading({title, sub, font, s = 1}: {title: string; sub: string; font?: string; s?: number}) {
  const ff = font ? {fontFamily: font} : null;
  return (
    <View style={{borderBottomWidth: 2, borderColor: INK, paddingBottom: 8, marginBottom: 12, marginHorizontal: 8, marginTop: 10}}>
      <Text style={[{fontSize: 30 * Math.min(s, 1.4), fontWeight: '700', color: INK}, ff]}>{title}</Text>
      <Text style={[{fontSize: 15 * s, color: GREY, marginTop: 2}, ff]}>{sub}</Text>
    </View>
  );
}

/** Every page with a hand-drawn five-point star, newest notes first. */
export function StarredPages({folders, nonce, font, s = 1}: {folders: string[]; nonce: number; font?: string; s?: number}) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [tick, setTick] = useState(0);
  const [alive] = useState(() => ({v: true}));
  useEffect(() => () => void (alive.v = false), [alive]);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('dashboard_refresh_all', () => setTick(t => t + 1));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const res = await scanStars(folders.length ? folders : ['/storage/emulated/0/Note'], 'off', false);
        const out: Card[] = [];
        for (const n of res.notes)
          for (const pg of n.pages)
            out.push({
              key: `${n.file}#${pg.page}`,
              path: n.file,
              page0: pg.page - 1,
              title: noteTitle(n.file),
              sub: `page ${pg.page}${pg.count > 1 ? ` · ${pg.count} stars` : ''}`,
              mtime: n.mtime,
              onPress: () => void openFile(n.file, pg.page),
            });
        if (alive.v) setCards(out);
      } catch (e: any) {
        log(`stars failed: ${e?.message}`);
        if (alive.v) setCards([]);
      }
    })();
  }, [nonce, tick, folders.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  usePreviews(cards, setCards, () => alive.v);
  const pages = cards?.length ?? 0;
  return (
    <ScrollView style={{flex: 1}}>
      <PageHeading title="★ Starred pages" sub={cards ? `${pages} page${pages === 1 ? '' : 's'} with a star drawn on them · tap one to open it` : 'looking for stars…'} font={font} s={s} />
      <CardGrid cards={cards} font={font} empty="No starred pages yet. Draw a five-point star on a page to add it." s={s} />
    </ScrollView>
  );
}

/** Supernote's own favourites (the ☆ in the file list), with page previews. */
export function FavouritesPage({paths, nonce, font, s = 1}: {paths: string[]; nonce: number; font?: string; s?: number}) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const [alive] = useState(() => ({v: true}));
  useEffect(() => () => void (alive.v = false), [alive]);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('dashboard_refresh_all', () => setTick(t => t + 1));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const out: Card[] = await Promise.all(
          paths.map(async p => {
            const mtime = await mtimeOf(p);
            return {
              key: p,
              path: p,
              page0: 0,
              title: isFolder(p) ? p.substring(p.lastIndexOf('/') + 1) : noteTitle(p),
              sub: isFolder(p) ? 'folder' : ago(mtime),
              mtime,
              onPress: () => openPath(p),
            };
          }),
        );
        if (alive.v) setCards(out);
      } catch (e: any) {
        if (alive.v) {
          setErr(String(e?.message ?? e));
          setCards([]);
        }
      }
    })();
  }, [nonce, tick, paths.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  usePreviews(cards, setCards, () => alive.v);
  const n = cards?.length ?? 0;
  return (
    <ScrollView style={{flex: 1}}>
      <PageHeading title="♡ Favourites" sub={cards ? `${n} favourite${n === 1 ? '' : 's'} · tap one to open it · change them in ⚙ Configuration → Home screen` : 'loading…'} font={font} s={s} />
      <CardGrid cards={cards} font={font} empty={err ? `Couldn't load favourites (${err}).` : 'No favourites yet. Add notes and folders in ⚙ Configuration → Home screen → Favourites.'} s={s} />
    </ScrollView>
  );
}

export function blockMatches(block: string, z: {type: string; title?: string}): boolean {
  if (block === 'favourites') return z.type === 'shortcuts';
  return z.type === block;
}

export type {HomeConfig};

// ---- Bookshelf: shelves of covers the user chooses ---------------------------
const DOC_EXT = /\.(pdf|epub|doc|docx|txt|cbz|fb2|xps)$/i;
const PER_SHELF = 5; // five covers fit across the page, so shelves don't scroll

export type ShelfKind = 'notes' | 'docs' | 'favourites' | 'starred';
export const SHELF_TITLES: Record<ShelfKind, string> = {
  notes: 'Recently opened notes',
  docs: 'Recently read',
  favourites: 'Favourites',
  starred: 'Starred pages',
};

interface Book {
  key: string;
  path: string;
  mtime: number;
  page0: number; // page to preview (0-based, -1 = last)
  openPage: number; // page to open (1-based, 0 = where you left off)
  png?: string;
}

const isFolderPath = (p: string) => !/\.[a-z0-9]{2,5}$/i.test(p);

function Cover({b, font, s}: {b: Book; font?: string; s: number}) {
  const ff = font ? {fontFamily: font} : null;
  const t = Math.min(s, 1.0);
  if (isFolderPath(b.path) || DOC_EXT.test(b.path)) {
    const folder = isFolderPath(b.path);
    return (
      <View style={{aspectRatio: 0.75, backgroundColor: folder ? '#5a5a5a' : '#3a3a3a', borderLeftWidth: 10, borderColor: '#1e1e1e', padding: 16, justifyContent: 'space-between'}}>
        <Text style={[{fontSize: 22 * t, fontWeight: '600', color: '#ffffff', lineHeight: 28 * t}, ff]} numberOfLines={6}>
          {folder ? b.path.substring(b.path.lastIndexOf('/') + 1) : noteTitle(b.path)}
        </Text>
        <Text style={{fontSize: 13, letterSpacing: 3, color: '#cccccc'}}>{folder ? 'FOLDER' : (b.path.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <View style={{aspectRatio: 0.75, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#444444', overflow: 'hidden', alignItems: 'center', justifyContent: 'center'}}>
      {b.png ? (
        <Image source={{uri: 'file://' + b.png}} style={{width: '100%', height: '100%'}} resizeMode="cover" resizeMethod="resize" fadeDuration={0} />
      ) : (
        <Text style={[{fontSize: 18 * s, color: GREY, padding: 10, textAlign: 'center'}, ff]}>{noteTitle(b.path)}</Text>
      )}
    </View>
  );
}

/** One shelf: covers standing on a dark plank, its name on a black label, scrolling sideways. */
function Shelf({title, books, font, s}: {title: string; books: Book[] | null; font?: string; s: number}) {
  const ff = font ? {fontFamily: font} : null;
  return (
    <View style={{marginBottom: 54}}>
      <View style={{flexDirection: 'row', paddingHorizontal: 30, alignItems: 'flex-end', minHeight: 230}}>
        {books === null && <Text style={[{fontSize: 17 * s, color: GREY, marginBottom: 20}, ff]}>loading…</Text>}
        {books?.length === 0 && <Text style={[{fontSize: 17 * s, color: GREY, marginBottom: 20}, ff]}>Nothing here yet.</Text>}
        {books?.map(b => (
          <TouchableOpacity key={b.key} onPress={() => (isFolderPath(b.path) ? openFolder(b.path) : openFile(b.path, b.openPage))} style={{width: '17.6%', marginRight: '3%'}}>
            <Cover b={b} font={font} s={s} />
            <View style={{position: 'absolute', right: -4, top: 4, bottom: -4, width: 4, backgroundColor: '#bdbdbd'}} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={{height: 22, backgroundColor: '#5a5a5a', borderBottomWidth: 6, borderColor: '#3a3a3a', marginTop: -4}} />
      <View style={{position: 'absolute', left: 44, bottom: -28, backgroundColor: '#111111', paddingVertical: 5, paddingHorizontal: 16}}>
        <Text style={[{fontSize: 17 * Math.min(s, 1.3), color: '#ffffff', letterSpacing: 1}, ff]}>{title}</Text>
      </View>
    </View>
  );
}

async function booksFor(kind: ShelfKind, favPaths: string[], starFolders: string[]): Promise<Book[]> {
  if (kind === 'favourites') {
    return Promise.all(favPaths.slice(0, PER_SHELF).map(async p => ({key: p, path: p, mtime: await mtimeOf(p), page0: 0, openPage: 0})));
  }
  if (kind === 'starred') {
    const res = await scanStars(starFolders.length ? starFolders : ['/storage/emulated/0/Note'], 'off', false);
    const out: Book[] = [];
    for (const n of res.notes) for (const pg of n.pages) out.push({key: `${n.file}#${pg.page}`, path: n.file, mtime: n.mtime, page0: pg.page - 1, openPage: pg.page});
    return out.slice(0, PER_SHELF);
  }
  let paths: string[] = [];
  try {
    paths = await recentModifiedFiles(PER_SHELF * 4);
  } catch {
    paths = await readRecent().catch(() => []);
  }
  const want = kind === 'notes' ? (p: string) => /\.note$/i.test(p) : (p: string) => DOC_EXT.test(p);
  const picked = paths.filter(want).slice(0, PER_SHELF);
  return Promise.all(picked.map(async p => ({key: p, path: p, mtime: await mtimeOf(p), page0: -1, openPage: 0})));
}

/** The Bookshelf page: the shelves the user chose in settings, in their order. */
export function RecentShelves({shelves, favPaths, starFolders, nonce, font, s = 1}: {shelves: ShelfKind[]; favPaths: string[]; starFolders: string[]; nonce: number; font?: string; s?: number}) {
  const [books, setBooks] = useState<Record<string, Book[] | null>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('dashboard_refresh_all', () => setTick(t => t + 1));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      const all: Record<string, Book[]> = {};
      for (const k of shelves) {
        try {
          all[k] = await booksFor(k, favPaths, starFolders);
        } catch (e: any) {
          log(`shelf ${k} failed: ${e?.message}`);
          all[k] = [];
        }
        if (!alive) return;
        setBooks(cur => ({...cur, [k]: all[k]}));
      }
      // previews one at a time: rendering pages is heavy on the tablet
      for (const k of shelves)
        for (const b of all[k] ?? []) {
          if (isFolderPath(b.path) || DOC_EXT.test(b.path)) continue;
          const png = await pagePreview(b.path, b.mtime, b.page0);
          if (!alive) return;
          if (png) setBooks(cur => ({...cur, [k]: (cur[k] ?? []).map(x => (x.key === b.key ? {...x, png} : x))}));
        }
    })();
    return () => {
      alive = false;
    };
  }, [nonce, tick, shelves.join('|'), favPaths.join('|'), starFolders.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const ff = font ? {fontFamily: font} : null;
  return (
    <ScrollView style={{flex: 1, backgroundColor: '#ffffff'}} contentContainerStyle={{paddingTop: 16, paddingBottom: 60}}>
      <Text style={[{fontSize: 34, fontWeight: '300', color: INK, marginLeft: 30, marginBottom: 26}, ff]}>Bookshelf</Text>
      {shelves.length === 0 && <Text style={[{fontSize: 18, color: GREY, marginLeft: 30}, ff]}>No shelves chosen. Pick them in SuperHub settings → Bookshelf.</Text>}
      {shelves.map(k => (
        <Shelf key={k} title={SHELF_TITLES[k]} books={books[k] ?? null} font={font} s={s} />
      ))}
    </ScrollView>
  );
}
