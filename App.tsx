/**
 * Dashboard: root router. Bubble tap → Dashboard surface; toolbar button →
 * Settings surface. See docs/dashboard-spec.md.
 * @format
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {DeviceEventEmitter, Image, NativeModules, ScrollView, Text, TouchableOpacity, View} from 'react-native';

import {getRoute, setRoute, Route} from './src/route';
import {DashboardConfig, loadConfig, saveConfig, blockHeightPx, newZone} from './src/config';
import {leavePlugin} from './src/bubble';
import {tscale, ZoneView} from './src/zones';
import {setCornerRadius, ui} from './src/ui';
import {HubSettings} from './src/hubsettings';
import {NewNoteScreen} from './src/newnote';
import type {DockItem} from './src/config';
import {autoRefreshTitles} from './src/notetoc';
import {timed} from './src/perf';
import {blockMatches, Dock, FavouritesPage, HomeClock, openToday, RecentShelves, RecentStrip, ShelfKind, StarredPages} from './src/home';
import {ConsoleHome} from './src/console';

const SCALE: Record<string, number> = {S: 1, M: 1.18, L: 1.4, XL: 1.7};

const {DashboardNative} = NativeModules;

/** Stable RN fontFamily name for a MyStyle font path (registered natively at boot). */
function fontFamilyFor(path: string): string {
  let h = 0;
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) | 0;
  return 'udf' + (h >>> 0).toString(36);
}

function App(): React.JSX.Element {
  const [route, setRouteState] = useState<Route>(getRoute());
  useEffect(() => {
    setRouteState(getRoute());
    const sub = DeviceEventEmitter.addListener('dashboard_route', (r: Route) => setRouteState(r));
    return () => sub.remove();
  }, []);
  return route === 'dashboard' ? <DashboardScreen /> : <HubSettings />;
}

/** A fixed-height block whose inner scroll turns on ONLY when its content
 *  overflows. A block that fits stays non-scrolling, so a drag started on it
 *  scrolls the whole page; a drag on an overflowing block scrolls the block. */
function FixedBlock({height, children}: {height: number; children: React.ReactNode}) {
  const [overflow, setOverflow] = useState(false);
  return (
    <View style={{height}}>
      <ScrollView
        nestedScrollEnabled
        scrollEnabled={overflow}
        showsVerticalScrollIndicator={overflow}
        onContentSizeChange={(_w, h) => setOverflow(h > height + 1)}>
        {children}
      </ScrollView>
    </View>
  );
}

/** A round, icon-only header button: all the same size so the top row is uniform. */
const HEADER_ICONS: Record<string, any> = {
  gear: require('./assets/hub/gear.png'),
  refresh: require('./assets/hub/refresh.png'),
  fold: require('./assets/hub/fold.png'),
  back: require('./assets/hub/back.png'),
};

function HeaderIcon({glyph, onPress, gap}: {glyph: keyof typeof HEADER_ICONS; onPress: () => void; gap?: boolean}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
      style={{width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginLeft: gap ? 12 : 0, backgroundColor: '#ececec'}}>
      <Image source={HEADER_ICONS[glyph]} style={{width: 26, height: 26}} resizeMode="contain" fadeDuration={0} />
    </TouchableOpacity>
  );
}

function DashboardScreen(): React.JSX.Element {
  const [cfg, setCfg] = useState<DashboardConfig | null>(null);
  // `nonce` bumps every time the dashboard is (re)entered → live data (Recent)
  // and config re-read even though the view may be kept mounted across opens.
  const [nonce, setNonce] = useState(0);
  // Home layout: a dock button can open one block on its own (null = the home page).
  const [focus, setFocus] = useState<number | null>(null);
  // ...or one of the two full-screen pages: starred pages / Supernote favourites.
  const [page, setPage] = useState<'stars' | 'favourites' | 'recent' | null>(null);
  // ...or the New note screen for a New note button.
  const [newNote, setNewNote] = useState<Extract<DockItem, {kind: 'create'}> | null>(null);
  // Reload config + bump `nonce` on mount and every dashboard (re)entry, so
  // zones re-read their data against the fresh config in one render even though
  // the view is kept mounted across opens. The bubble is NO LONGER hidden here:
  // showing/hiding it is driven by AppState in index.js (the OS-level truth of
  // whether the view is really on screen), so a failed showPluginView can't hide
  // the bubble on a stale layout read anymore.
  const autoRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let alive = true;
    const enter = () => {
      loadConfig().then(async c => {
        if (!alive) return;
        // Register the user's MyStyle font (if any) BEFORE showing the config, so the
        // fontFamily resolves on the first render (RN won't re-resolve a font added later).
        if (c.font) {
          try {
            await DashboardNative?.registerFont?.(c.font, fontFamilyFor(c.font));
          } catch (e) {}
        }
        if (!alive) return;
        setCfg(c);
        setFocus(null);
        setPage(null);
        setNewNote(null);
        setNonce(n => n + 1);
        // Keep the shared title cache fresh for Search even when no Contents block
        // is shown: re-read notes modified since the last watermark. Deferred so it
        // never blocks the open; runs only when something actually needs titles.
        const needsTitles = c.zones.some(z => z.type === 'toc' || (z.type === 'search' && (z as any).searchTitles));
        if (needsTitles) {
          if (autoRefreshTimer.current) clearTimeout(autoRefreshTimer.current); // never stack timers across re-entries
          autoRefreshTimer.current = setTimeout(() => {
            if (alive) void timed('toc:autoRefresh', autoRefreshTitles, r => `${r.done}/${r.modified} read`).catch(() => {});
          }, 1800);
        }
      });
    };
    enter();
    const sub = DeviceEventEmitter.addListener('dashboard_route', (r: Route) => {
      if (r === 'dashboard') enter();
    });
    return () => {
      alive = false;
      sub.remove();
      if (autoRefreshTimer.current) clearTimeout(autoRefreshTimer.current);
    };
  }, []);

  const textScale = cfg?.textScale;
  const headingScale = cfg?.headingScale;
  const fontFamily = cfg?.font ? fontFamilyFor(cfg.font) : undefined;
  const ts = useMemo(
    () => tscale(textScale ? SCALE[textScale] ?? 1.4 : 1.4, headingScale ? SCALE[headingScale] ?? 1 : 1, fontFamily),
    [textScale, headingScale, fontFamily],
  );
  // If the page has both Stars and Keywords, the first scan warms both in one
  // pass (per-file cache) so the second zone's scan is instant.
  const sib = useMemo(
    () =>
      cfg
        ? {
            stars: cfg.zones.some(z => z.type === 'stars'),
            keywords: cfg.zones.some(z => z.type === 'keywords'),
          }
        : undefined,
    [cfg],
  );
  // The user's corner radius (Look → Corners) for every block frame / button below.
  setCornerRadius(cfg?.corners);
  const columns = cfg?.layout.columns ?? 1;
  const vmode = cfg?.layout.vmode ?? 'masonry';
  // Collapse/expand a block (persisted in config so it sticks across opens).
  const toggleCollapse = (i: number) => {
    if (!cfg) return;
    const next = {...cfg, zones: cfg.zones.map((z, k) => (k === i ? {...z, collapsed: !z.collapsed} : z))};
    setCfg(next);
    saveConfig(next);
  };
  // One block. In 'fixed' mode a non-spacer, non-collapsed block gets a set height
  // and scrolls inside; otherwise it takes its natural height.
  const renderZone = (z: DashboardConfig['zones'][number], i: number, cols = columns) => {
    const el = (
      <ZoneView
        zone={z}
        scan={cfg!.home?.on ? {...cfg!.scan, autoOnOpen: true} : cfg!.scan}
        theme={cfg!.theme}
        ts={ts}
        nonce={nonce}
        sib={sib}
        index={i}
        onToggleCollapse={toggleCollapse}
        showIcons={cfg!.showIcons}
        columns={cols}
      />
    );
    // Fixed mode reserves each block's slot height; INCLUDING when collapsed, so
    // collapsing one block doesn't pull the blocks below it up off the grid.
    if (vmode === 'fixed' && z.type !== 'spacer') {
      return (
        <FixedBlock key={i} height={blockHeightPx(z)}>
          {el}
        </FixedBlock>
      );
    }
    return <View key={i}>{el}</View>;
  };
  const colOf = (z: DashboardConfig['zones'][number]) => Math.max(0, Math.min(columns - 1, z.col ?? 0));
  // Full-width blocks (issue #3): across all columns, above or below the grid, in
  // list order. Meaningless with one column, where every block is full width and
  // keeps its list position.
  const spanOf = (z: DashboardConfig['zones'][number]) => (columns > 1 ? z.span : undefined);
  const band = (where: 'top' | 'bottom') => {
    const list = (cfg?.zones ?? []).map((z, i) => ({z, i})).filter(({z}) => spanOf(z) === where);
    return list.length ? <View style={{paddingHorizontal: 4}}>{list.map(({z, i}) => renderZone(z, i, 1))}</View> : null;
  };

  // Header chrome adopts the chosen design + font + text size (same ThemedButton as
  // the in-card Refresh buttons), so it stops looking like a heavy black box.
  const theme = cfg?.theme ?? 'boxed';
  const hbLine = theme === 'gridgray' ? '#888888' : '#000000';
  const ff = fontFamily ? {fontFamily} : null;

  const home = cfg?.home?.on ? cfg.home : null;
  const openBlock = (block: string) => {
    if (!cfg) return;
    if (block === 'settings') return setRoute('config');
    if (block === 'stars' || block === 'favourites' || block === 'recent') return setPage(block);
    const i = cfg.zones.findIndex(z => blockMatches(block, z));
    if (i >= 0) return setFocus(i);
    // No block of that kind yet (e.g. Search, Note Clips, To-do): add a default one, kept hidden on the home screen.
    const z = newZone(block);
    if (!z) return;
    const next = {...cfg, zones: [...cfg.zones, z]};
    setCfg(next);
    saveConfig(next);
    setFocus(next.zones.length - 1);
  };
  const focused = cfg && focus !== null ? cfg.zones[focus] : undefined;
  // Tapping a date on the month calendar opens that day's notebook, when a button points at dated notebooks.
  const dayRoot = (home?.dock.find(d => d.kind === 'today') as any)?.root as string | undefined;
  const starFolders = (cfg?.zones.find(z => z.type === 'stars') as any)?.folders ?? [];

  if (newNote) return <NewNoteScreen d={newNote} onClose={() => setNewNote(null)} />;

  // SuperHub-v3's home: the console fills the page (no header; the power light
  // closes SuperHub and the SUPERHUB name plate opens settings).
  if (cfg && home && !page && !focused)
    return (
      <ConsoleHome
        items={home.dock}
        labels={home.labels !== false}
        hour24={home.hour24}
        nonce={nonce}
        onBlock={openBlock}
        onNewNote={setNewNote}
      />
    );

  return (
    <View style={ui.container}>
      <View style={ui.header}>
        {/* Configuration pinned far left; the name centred; refresh + fold on the right. */}
        <View style={ui.headerBtns}>
          {focused || page ? (
            <HeaderIcon glyph="back" onPress={() => {setFocus(null); setPage(null);}} />
          ) : (
            <HeaderIcon glyph="gear" onPress={() => setRoute('config')} />
          )}
        </View>
        <Text style={[ui.title, {fontSize: 22 * ts.hs, color: hbLine, flex: 1, textAlign: 'center'}, ff]} numberOfLines={1}>
          {home ? '' : 'SuperHub'}
        </Text>
        <View style={ui.headerBtns}>
          <HeaderIcon glyph="refresh" onPress={() => DeviceEventEmitter.emit('dashboard_refresh_all')} />
          <HeaderIcon glyph="fold" gap onPress={() => leavePlugin()} />
        </View>
      </View>
      {!cfg && <Text style={ui.hint}>loading…</Text>}
      {cfg && !home && cfg.zones.length === 0 && (
        <Text style={ui.hint}>No zone. Configure the dashboard via ⚙ Settings.</Text>
      )}
      {cfg && page === 'recent' && (
        <RecentShelves
          shelves={(home?.shelves ?? ['notes', 'docs', 'favourites']) as ShelfKind[]}
          favPaths={(cfg.zones.find(z => z.type === 'favourites') as any)?.paths ?? []}
          starFolders={starFolders}
          nonce={nonce}
          font={fontFamily}
          s={ts.s}
        />
      )}
      {cfg && page === 'stars' && <StarredPages folders={starFolders} nonce={nonce} font={fontFamily} s={ts.s} />}
      {cfg && page === 'favourites' && <FavouritesPage paths={(cfg.zones.find(z => z.type === 'favourites') as any)?.paths ?? []} nonce={nonce} font={fontFamily} s={ts.s} />}
      {cfg && !page && focused && (
        <ScrollView style={{flex: 1}}>
          <View style={{paddingHorizontal: 4}}>{renderZone(focused, focus!, 1)}</View>
        </ScrollView>
      )}
      {cfg && !page && !focused && (
        home ? (
          // Home screen: framed clock on top, the icon grid in the middle, recent pages at the bottom.
          // The blocks themselves stay hidden; buttons open them full screen.
          <ScrollView style={{flex: 1}} contentContainerStyle={{flexGrow: 1}}>
            <View style={{flex: 1, justifyContent: 'space-between', paddingHorizontal: 6}}>
              <HomeClock hour24={home.hour24} nonce={nonce} font={fontFamily} bold={home.clockBold} onDay={dayRoot ? d => void openToday(dayRoot, d) : undefined} />
              <View style={{flex: 1, justifyContent: 'center', paddingVertical: 20}}>
                <Dock items={home.dock} onBlock={openBlock} onNewNote={setNewNote} font={fontFamily} />
              </View>
              <RecentStrip count={home.recent} nonce={nonce} font={fontFamily} />
            </View>
          </ScrollView>
        ) : (
        <ScrollView style={{flex: 1}}>
          {band('top')}
          {/* Each column is its own independent vertical stack (heights differ freely). */}
          <View style={ui.zoneGrid}>
            {Array.from({length: columns}).map((_, ci) => (
              <View key={ci} style={ui.zoneCol}>
                {cfg.zones
                  .map((z, i) => ({z, i}))
                  .filter(({z}) => !spanOf(z) && colOf(z) === ci)
                  .map(({z, i}) => renderZone(z, i))}
              </View>
            ))}
          </View>
          {band('bottom')}
        </ScrollView>
        )
      )}
    </View>
  );
}

export default App;
