/**
 * SuperHub settings: one page, large type, big tap targets. Everything here is
 * about the home screen and the SuperHub pages its buttons open; SuperDashboard's
 * layouts, themes and blocks are not used by SuperHub and are not offered.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Image, NativeModules, ScrollView, Text, TextInput, TouchableOpacity, View} from 'react-native';

import {
  DashboardConfig,
  DockItem,
  DEFAULT_HOME,
  deleteProfile,
  listProfiles,
  loadConfig,
  loadProfile,
  MAX_DOCK,
  saveConfig,
  saveProfile,
  TextScale,
} from './config';
import {SHELF_TITLES, USER_ICON_DIR} from './home';
import {SLOT_NAMES} from './console';
import {ICONS} from './icons';
import {leavePlugin} from './bubble';
import {setRoute} from './route';
import {storageRoots, StorageRoot, SD_SYSTEM_DIR} from './storage';
import {systemTemplates} from './open';

const {DashboardNative} = NativeModules;
const ROOT = '/storage/emulated/0';
const INK = '#000000';
const GREY = '#555555';

// ---- type scale: large, sized for a finger --------------------------------------
export const T = {title: 30, h: 26, body: 21, small: 18, btn: 21};

export const st = {
  card: {borderWidth: 1.5, borderColor: '#c8c8c8', borderRadius: 24, padding: 22, marginBottom: 22, backgroundColor: '#ffffff'},
  h: {fontSize: T.h, fontWeight: '700' as const, color: INK, marginBottom: 6},
  p: {fontSize: T.small, color: GREY, marginBottom: 12, lineHeight: 26},
  label: {fontSize: T.body, fontWeight: '600' as const, color: INK, marginTop: 14, marginBottom: 8},
  row: {flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const},
};

export function Btn({label, onPress, on, primary, disabled, wide}: {label: string; onPress: () => void; on?: boolean; primary?: boolean; disabled?: boolean; wide?: boolean}) {
  const dark = on || primary;
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 60,
        minWidth: wide ? 200 : 60,
        paddingHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 30,
        backgroundColor: dark ? INK : '#ececec',
        marginRight: 10,
        marginBottom: 10,
      }}>
      <Text style={{fontSize: T.btn, fontWeight: '600', color: disabled ? '#bbbbbb' : dark ? '#ffffff' : INK}}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Choice<V extends string>({options, value, onChange}: {options: {v: V; label: string}[]; value: V; onChange: (v: V) => void}) {
  return (
    <View style={st.row}>
      {options.map(o => (
        <Btn key={o.v} label={o.label} on={o.v === value} onPress={() => onChange(o.v)} />
      ))}
    </View>
  );
}

function Card({title, note, children}: {title: string; note?: string; children: React.ReactNode}) {
  return (
    <View style={st.card}>
      <Text style={st.h}>{title}</Text>
      {note ? <Text style={st.p}>{note}</Text> : null}
      {children}
    </View>
  );
}

/** A full-screen chooser with a big title and a big Cancel. */
function Screen({title, onClose, right, children}: {title: string; onClose: () => void; right?: React.ReactNode; children: React.ReactNode}) {
  return (
    <View style={{flex: 1, backgroundColor: '#ffffff', padding: 20}}>
      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 14}}>
        <Text style={{fontSize: T.title, fontWeight: '700', color: INK, flex: 1}} numberOfLines={1}>
          {title}
        </Text>
        {right}
        <Btn label="Cancel" onPress={onClose} />
      </View>
      {children}
    </View>
  );
}

// ---- what a button opens ---------------------------------------------------------
const PAGES: {v: string; label: string; note: string}[] = [
  {v: 'favourites', label: 'Favourites', note: 'your chosen notes and folders (set below)'},
  {v: 'stars', label: 'Starred pages', note: 'every page you drew a five-point star on'},
  {v: 'keywords', label: 'Keywords', note: 'the keywords in your notes'},
  {v: 'search', label: 'Search', note: 'search names, keywords and headings'},
  {v: 'clips', label: 'Note Clips', note: 'snippets you lassoed and clipped'},
  {v: 'todo', label: 'To-do', note: 'tasks you captured from notes'},
  {v: 'close', label: 'Close SuperHub', note: 'the same as the ⌄ fold button: back to where you were, with the floating house'},
  {v: 'recent', label: 'Bookshelf', note: 'three shelves you choose: recent notes, recent reading, favourites, starred pages'},
];

const short = (p: string) => p.replace(ROOT, '').replace(/^\//, '') || 'Internal storage';
const baseName = (p: string) => p.substring(p.lastIndexOf('/') + 1).replace(/\.(note|pdf|epub)$/i, '');

function describe(d: DockItem): string {
  switch (d.kind) {
    case 'none':
      return 'Nothing yet';
    case 'folder':
      return 'Folder: ' + short(d.path);
    case 'note':
      return 'File: ' + short(d.path);
    case 'app':
      return 'App: ' + (d.appLabel || d.component.split('/')[0]);
    case 'today':
      return "Today's notebook in " + short(d.root);
    case 'block':
      return 'SuperHub page: ' + (PAGES.find(p => p.v === d.block)?.label ?? d.block);
    case 'create':
      return (d.doc ? 'A new typed document in ' : 'A new note in ') + short(d.folder);
  }
}

// ---- pickers ------------------------------------------------------------------------
async function listDirSorted(d: string): Promise<any[]> {
  try {
    let list: any[] = (await DashboardNative.listDir(d)) ?? [];
    list = list.filter(e => !e.name.startsWith('.'));
    if (!d.startsWith(ROOT)) list = list.filter(e => !(e.isDir && SD_SYSTEM_DIR.test(e.name)));
    list.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    return list;
  } catch {
    return [];
  }
}
const OPENABLE = /\.(note|pdf|epub|cbz|fb2|xps|txt|doc|docx)$/i;

/** Pick a folder (mode 'folder') or a file (mode 'file'). One tap on a file picks it. */
export function PathPicker({mode, start, onPick, onClose}: {mode: 'folder' | 'file'; start?: string; onPick: (path: string) => void; onClose: () => void}) {
  const [dir, setDir] = useState(start ?? ROOT + '/Note');
  const [items, setItems] = useState<any[] | null>(null);
  const [roots, setRoots] = useState<StorageRoot[]>([]);
  const load = async (d: string) => {
    setItems(null);
    setDir(d);
    setItems(await listDirSorted(d));
  };
  useEffect(() => {
    load(dir);
    storageRoots().then(setRoots).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const root = roots.find(r => dir === r.root || dir.startsWith(r.root + '/'))?.root ?? ROOT;
  const atRoot = dir === root;
  const shown = (items ?? []).filter(e => e.isDir || (mode === 'file' && OPENABLE.test(e.name)));
  return (
    <Screen title={mode === 'folder' ? 'Choose a folder' : 'Choose a file'} onClose={onClose}>
      {roots.length > 1 && (
        <View style={st.row}>
          {roots.map(r => (
            <Btn key={r.root} label={r.label} on={r.root === root} onPress={() => load(r.root)} />
          ))}
        </View>
      )}
      <View style={st.row}>
        <Btn label="⬆  Up" disabled={atRoot} onPress={() => load(dir.substring(0, dir.lastIndexOf('/')) || root)} />
        {mode === 'folder' && <Btn primary label="✓  Use this folder" onPress={() => onPick(dir)} />}
      </View>
      <Text style={{fontSize: T.body, color: INK, fontWeight: '600', marginVertical: 8}}>{short(dir)}</Text>
      <ScrollView style={{flex: 1, borderTopWidth: 2, borderColor: INK}}>
        {items === null && <Text style={st.p}>loading…</Text>}
        {items !== null && shown.length === 0 && <Text style={[st.p, {marginTop: 12}]}>{mode === 'file' ? 'No notes or documents here.' : 'No folders inside.'}</Text>}
        {shown.map(e => (
          <TouchableOpacity
            key={e.path}
            onPress={() => (e.isDir ? load(e.path) : onPick(e.path))}
            style={{minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#cccccc', paddingHorizontal: 6}}>
            <Text style={{fontSize: 26, width: 46}}>{e.isDir ? '📁' : '📄'}</Text>
            <Text style={{fontSize: T.body, color: INK, flex: 1}} numberOfLines={1}>
              {e.name}
            </Text>
            {e.isDir && <Text style={{fontSize: 28, color: GREY}}>›</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Screen>
  );
}

/** Launcher entries that are not apps a person would open from a home button
 *  (Android internals, Ratta services, and the camera app: the tablet has no camera). */
const NOT_APPS =
  /camera|com\.android\.settings|documentsui|inputmethod|pluginhost|supernote\.unlock|supernote\.background|factorytest|screencast|supernote\.launcher|serverlink|drawpath/i;

function AppPicker({onPick, onClose}: {onPick: (a: {label: string; component: string}) => void; onClose: () => void}) {
  const [apps, setApps] = useState<{label: string; component: string}[] | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const list: any[] = (await DashboardNative.listLaunchableApps()) ?? [];
        const seen = new Set<string>();
        const out = list
          .map(a => ({label: String(a.label ?? ''), component: String(a.component ?? '')}))
          .filter(a => a.component && !NOT_APPS.test(a.component) && !seen.has(a.component) && seen.add(a.component));
        out.sort((a, b) => a.label.localeCompare(b.label));
        setApps(out);
      } catch {
        setApps([]);
      }
    })();
  }, []);
  return (
    <Screen title="Choose an app" onClose={onClose}>
      <Text style={st.p}>The apps installed on this Supernote.</Text>
      <ScrollView style={{flex: 1, borderTopWidth: 2, borderColor: INK}}>
        {apps === null && <Text style={st.p}>loading…</Text>}
        {apps?.map(a => (
          <TouchableOpacity
            key={a.component}
            onPress={() => onPick(a)}
            style={{minHeight: 72, justifyContent: 'center', borderBottomWidth: 1, borderColor: '#cccccc', paddingHorizontal: 10}}>
            <Text style={{fontSize: T.body, color: INK}}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Backups({cfg, onLoad, onClose}: {cfg: DashboardConfig; onLoad: (c: DashboardConfig) => void; onClose: () => void}) {
  const [names, setNames] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const reload = () => listProfiles().then(setNames).catch(() => setNames([]));
  useEffect(() => void reload(), []);
  const save = async () => {
    const n = name.trim() || new Date().toISOString().slice(0, 16).replace('T', ' ');
    await saveProfile(n, cfg);
    setName('');
    setMsg(`Saved “${n}”.`);
    reload();
  };
  return (
    <Screen title="Saved copies of your settings" onClose={onClose}>
      <Text style={st.p}>
        Save a copy of all your SuperHub settings under a name, and bring it back at any time. Copies are kept in MyStyle/Plugins/SuperHub-v3/profiles.json, so they survive
        updates and reinstalls. SuperHub also keeps an automatic backup of the last settings it saved.
      </Text>
      <View style={st.row}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name (optional)"
          placeholderTextColor="#999999"
          showSoftInputOnFocus
          style={{flex: 1, minWidth: 260, minHeight: 64, fontSize: T.body, borderWidth: 2, borderColor: INK, borderRadius: 12, paddingHorizontal: 14, marginRight: 10, marginBottom: 10, color: INK}}
        />
        <Btn primary label="Save a copy" onPress={save} />
      </View>
      {msg ? <Text style={[st.p, {color: INK}]}>{msg}</Text> : null}
      <ScrollView style={{flex: 1, borderTopWidth: 2, borderColor: INK}}>
        {names.length === 0 && <Text style={[st.p, {marginTop: 12}]}>No saved copies yet.</Text>}
        {names.map(n => (
          <View key={n} style={{minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#cccccc'}}>
            <Text style={{fontSize: T.body, color: INK, flex: 1}} numberOfLines={1}>
              {n}
            </Text>
            <Btn
              label="Use this"
              onPress={async () => {
                const c = await loadProfile(n);
                if (c) onLoad(c);
              }}
            />
            <Btn
              label="Delete"
              onPress={async () => {
                await deleteProfile(n);
                reload();
              }}
            />
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

// ---- one home button ---------------------------------------------------------------
type Picker = {kind: 'folder' | 'file' | 'today' | 'create' | 'createdoc' | 'app' | 'favourite-file' | 'favourite-folder' | 'scan-folder'} | {kind: 'backups'} | null;

function NameField({value, onSave}: {value: string; onSave: (v: string) => void}) {
  const [t, setT] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setT(value), [value]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <TextInput
      value={t}
      onChangeText={v => {
        setT(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onSave(v.trim()), 600);
      }}
      onBlur={() => onSave(t.trim())}
      onSubmitEditing={() => onSave(t.trim())}
      placeholder="Type a name"
      placeholderTextColor="#999999"
      showSoftInputOnFocus
      returnKeyType="done"
      autoCorrect={false}
      style={{minHeight: 68, fontSize: 24, borderWidth: 1.5, borderColor: '#c8c8c8', borderRadius: 18, paddingHorizontal: 18, color: INK, backgroundColor: '#ffffff'}}
    />
  );
}

function ButtonEditor({i, d, n, setItem, swap, clear, openPicker, userIcons}: {
  i: number;
  d: DockItem;
  n: number;
  setItem: (d: DockItem) => void;
  swap: (k: number) => void;
  clear: () => void;
  openPicker: (p: Picker) => void;
  userIcons: string[];
}) {
  const [pages, setPages] = useState(false);
  const [pics, setPics] = useState(false);
  const base = {label: d.label, glyph: d.glyph, icon: d.icon};
  const icons = [...Object.keys(ICONS).sort(), ...userIcons];
  return (
    <View style={[st.card, {borderColor: INK}]}>
      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}>
        <View style={{flex: 1}}>
          <Text style={{fontSize: T.h, fontWeight: '700', color: INK}}>{SLOT_NAMES[i] ?? `Button ${i + 1}`}</Text>
          <Text style={{fontSize: T.small, color: GREY, marginTop: 4}}>{describe(d)}</Text>
        </View>
      </View>

      <Text style={st.label}>Name</Text>
      <NameField value={d.label} onSave={v => v !== d.label && setItem({...d, label: v})} />

      <Text style={st.label}>Opens</Text>
      <View style={st.row}>
        <Btn label="Folder" on={d.kind === 'folder'} onPress={() => openPicker({kind: 'folder'})} />
        <Btn label="Note or document" on={d.kind === 'note'} onPress={() => openPicker({kind: 'file'})} />
        <Btn label="App" on={d.kind === 'app'} onPress={() => openPicker({kind: 'app'})} />
        <Btn label="SuperHub page" on={d.kind === 'block' || pages} onPress={() => setPages(p => !p)} />
        <Btn label="Today's notebook" on={d.kind === 'today'} onPress={() => openPicker({kind: 'today'})} />
        <Btn label="New note" on={d.kind === 'create' && !d.doc} onPress={() => openPicker({kind: 'create'})} />
        <Btn label="New typed document" on={d.kind === 'create' && !!d.doc} onPress={() => openPicker({kind: 'createdoc'})} />
      </View>
      {d.kind === 'create' && !d.doc && (
        <>
          <Text style={st.label}>When tapped</Text>
          <Choice
            options={[{v: 'ask', label: 'Let me choose each time'}, {v: 'go', label: 'Make it straight away'}]}
            value={d.ask === false ? 'go' : 'ask'}
            onChange={v => setItem({...d, ask: v === 'ask'})}
          />
          {d.ask === false ? (
            <NewNoteOptions d={d} setItem={setItem} />
          ) : (
            <Text style={st.p}>Tapping the button opens a New note screen where you choose the name, folder ({short(d.folder)} to start with), page style, handwriting recognition and orientation.</Text>
          )}
        </>
      )}
      {d.kind === 'create' && d.doc && (
        <Text style={st.p}>
          Makes a new document in {short(d.folder)} and opens it in the Supernote's document editor, where you type instead of write. Tap “New typed document” again to choose another folder.
        </Text>
      )}
      {pages && (
        <View style={{marginTop: 4}}>
          {PAGES.map(p => (
            <TouchableOpacity
              key={p.v}
              onPress={() => {
                setItem({...base, kind: 'block', block: p.v as any, label: d.label || p.label});
                setPages(false);
              }}
              style={{minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#cccccc'}}>
              <Text style={{fontSize: T.body, fontWeight: '700', color: INK, width: 200}}>
                {d.kind === 'block' && d.block === p.v ? '✓ ' : ''}
                {p.label}
              </Text>
              <Text style={{fontSize: T.small, color: GREY, flex: 1}}>{p.note}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {d.kind === 'today' && (
        <Text style={st.p}>
          Opens today's notebook in this folder: a notebook named by date, like {short(d.root)}/{new Date().getFullYear()}/
          {new Date().toISOString().slice(0, 10)}.note. Handy for a planner or journal with one notebook per day.
        </Text>
      )}

      <Text style={st.label}>Move to another button</Text>
      <Text style={[st.p, {marginBottom: 6}]}>Swaps with whatever that button opens now.</Text>
      <View style={st.row}>
        {Array.from({length: n}).map((_, k) => (
          <Btn key={k} label={SLOT_NAMES[k] ?? String(k + 1)} on={k === i} onPress={() => swap(k)} />
        ))}
      </View>

      <View style={[st.row, {marginTop: 10}]}>
        <Btn label="Empty this button" onPress={clear} />
      </View>
    </View>
  );
}

/** Options for a New note button: where it goes, its page style, recognition. */
function NewNoteOptions({d, setItem}: {d: Extract<DockItem, {kind: 'create'}>; setItem: (d: DockItem) => void}) {
  const [styles, setStyles] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && styles === null) systemTemplates().then(setStyles);
  }, [open, styles]);
  const nice = (n: string) => n.replace(/^style_/, '').replace(/_/g, ' ');
  return (
    <View style={{marginTop: 4}}>
      <Text style={st.p}>
        Makes a new notebook in {short(d.folder)}, named with today's date and time like the Supernote does, and opens it. Tap “New note” again to choose another folder.
      </Text>
      <Text style={st.label}>Page style</Text>
      <View style={st.row}>
        <Btn label={d.template ? nice(d.template) : 'Plain white'} on onPress={() => setOpen(o => !o)} />
        <Btn label={open ? 'Hide styles' : 'Choose a style'} onPress={() => setOpen(o => !o)} />
      </View>
      {open && (
        <View>
          {styles === null && <Text style={st.p}>loading…</Text>}
          {styles?.map(n => (
            <TouchableOpacity
              key={n}
              onPress={() => {
                setItem({...d, template: n});
                setOpen(false);
              }}
              style={{minHeight: 64, justifyContent: 'center', borderBottomWidth: 1, borderColor: '#cccccc'}}>
              <Text style={{fontSize: T.body, color: INK}}>
                {n === d.template ? '✓ ' : ''}
                {nice(n)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={st.label}>Handwriting recognition while you write</Text>
      <Choice options={[{v: 'off', label: 'Off'}, {v: 'on', label: 'On'}]} value={d.recognition ? 'on' : 'off'} onChange={v => setItem({...d, recognition: v === 'on'})} />
    </View>
  );
}

// ---- the settings page ------------------------------------------------------------------
async function listUserIcons(): Promise<string[]> {
  try {
    const list: any[] = (await DashboardNative.listDir(USER_ICON_DIR)) ?? [];
    return list
      .filter(e => !e.isDir && /\.(png|jpe?g)$/i.test(e.name))
      .map(e => e.path as string)
      .sort();
  } catch {
    return [];
  }
}

export function HubSettings(): React.JSX.Element {
  const [cfg, setCfg] = useState<DashboardConfig | null>(null);
  const [sel, setSel] = useState(0);
  const [picker, setPicker] = useState<Picker>(null);
  const [userIcons, setUserIcons] = useState<string[]>([]);
  useEffect(() => {
    loadConfig().then(setCfg);
  }, []);

  const update = (fn: (c: DashboardConfig) => void) => {
    setCfg(prev => {
      if (!prev) return prev;
      const next: DashboardConfig = JSON.parse(JSON.stringify(prev));
      fn(next);
      saveConfig(next);
      return next;
    });
  };
  if (!cfg) return <View style={{flex: 1, backgroundColor: '#fff'}}><Text style={[st.p, {margin: 30}]}>loading…</Text></View>;

  const dock = cfg.home.dock;
  const cur = dock[Math.min(sel, dock.length - 1)];
  const setItem = (k: number, d: DockItem) => update(c => void (c.home.dock[k] = d));
  const base = cur ? {label: cur.label, glyph: cur.glyph, icon: cur.icon} : {label: '', glyph: '+'};

  const zoneIndex = (type: string) => cfg.zones.findIndex(z => z.type === type);
  const favPaths: string[] = ((cfg.zones[zoneIndex('favourites')] as any)?.paths ?? []) as string[];
  const scanFolders: string[] = ((cfg.zones[zoneIndex('stars')] as any)?.folders ?? []) as string[];
  const editZone = (type: string, fn: (z: any) => void) =>
    update(c => {
      let k = c.zones.findIndex(z => z.type === type);
      if (k < 0) {
        c.zones.push({type, title: type, paths: [], folders: [], col: 0} as any);
        k = c.zones.length - 1;
      }
      fn(c.zones[k]);
    });
  const setScanFolders = (fn: (f: string[]) => void) => {
    for (const t of ['stars', 'keywords']) editZone(t, z => void fn((z.folders = z.folders ?? [])));
  };

  // ---- pickers take over the whole screen ----
  if (picker) {
    const close = () => setPicker(null);
    if (picker.kind === 'backups')
      return (
        <Backups
          cfg={cfg}
          onClose={close}
          onLoad={c => {
            update(x => void Object.assign(x, c));
            close();
          }}
        />
      );
    if (picker.kind === 'app')
      return (
        <AppPicker
          onClose={close}
          onPick={a => {
            setItem(sel, {...base, kind: 'app', component: a.component, appLabel: a.label, label: cur.label || a.label});
            close();
          }}
        />
      );
    const mode = picker.kind === 'file' || picker.kind === 'favourite-file' ? 'file' : 'folder';
    return (
      <PathPicker
        mode={mode}
        onClose={close}
        onPick={p => {
          if (picker.kind === 'folder') setItem(sel, {...base, kind: 'folder', path: p, label: cur.label || baseName(p)});
          else if (picker.kind === 'file') setItem(sel, {...base, kind: 'note', path: p, label: cur.label || baseName(p)});
          else if (picker.kind === 'createdoc') setItem(sel, {...base, kind: 'create', folder: p, doc: true, label: cur.label || 'New document'});
          else if (picker.kind === 'create')
            setItem(sel, {...base, kind: 'create', folder: p, template: cur.kind === 'create' ? cur.template : undefined, recognition: cur.kind === 'create' ? cur.recognition : undefined, label: cur.label || 'New note'});
          else if (picker.kind === 'today') setItem(sel, {...base, kind: 'today', root: p, label: cur.label || baseName(p)});
          else if (picker.kind === 'favourite-file' || picker.kind === 'favourite-folder') editZone('favourites', z => void (!(z.paths ??= []).includes(p) && z.paths.push(p)));
          else if (picker.kind === 'scan-folder') setScanFolders(f => void (!f.includes(p) && f.push(p)));
          close();
        }}
      />
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: '#ffffff'}}>
      <View style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 2, borderColor: INK}}>
        <Text style={{fontSize: T.title, fontWeight: '700', color: INK, flex: 1}}>SuperHub-v3 settings</Text>
        <Btn primary label="Done" onPress={() => setRoute('dashboard')} />
        <Btn label="Close" onPress={() => leavePlugin()} />
      </View>
      <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20}} keyboardShouldPersistTaps="handled">
        <Card title="Console buttons" note="Tap a button to change its name and what it opens. Changes are saved as you go.">
          <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
            {dock.map((d, k) => (
              <TouchableOpacity
                key={k}
                onPress={() => setSel(k)}
                style={{width: '33.33%', alignItems: 'center', paddingVertical: 14, borderWidth: k === sel ? 3 : 0, borderColor: INK, borderRadius: 14}}>
                <Text style={{fontSize: 15, color: GREY}} numberOfLines={1}>
                  {SLOT_NAMES[k]}
                </Text>
                <Text style={{fontSize: 19, fontWeight: '600', color: d.label ? INK : '#999999', marginTop: 4}} numberOfLines={1}>
                  {d.label || 'Empty'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {cur && (
          <ButtonEditor
            key={sel}
            i={sel}
            d={cur}
            n={dock.length}
            userIcons={userIcons}
            setItem={d => setItem(sel, d)}
            swap={k =>
              update(c => {
                const x = c.home.dock;
                [x[sel], x[k]] = [x[k], x[sel]];
                setSel(k);
              })
            }
            clear={() => setItem(sel, {kind: 'none', label: '', glyph: '+'})}
            openPicker={setPicker}
          />
        )}

        <Card title="Clock">
          <Choice options={[{v: '24', label: '24-hour'}, {v: '12', label: '12-hour'}]} value={cfg.home.hour24 ? '24' : '12'} onChange={v => update(c => void (c.home.hour24 = v === '24'))} />
        </Card>

        <Card title="Button names" note="Show each console button's name beside it, or just the buttons.">
          <Choice options={[{v: 'on', label: 'Show names'}, {v: 'off', label: 'Buttons only'}]} value={cfg.home.labels === false ? 'off' : 'on'} onChange={v => update(c => void (c.home.labels = v === 'on'))} />
        </Card>

        <Card title="Bookshelf" note="The Bookshelf page has three shelves of up to five covers. Choose what each shelf shows, then point a button at the Bookshelf.">
          {[0, 1, 2].map(k => (
            <View key={k}>
              <Text style={st.label}>Shelf {k + 1}</Text>
              <Choice
                options={(['notes', 'docs', 'favourites', 'starred'] as const).map(v => ({v, label: SHELF_TITLES[v]}))}
                value={(cfg.home.shelves ?? ['notes', 'docs', 'favourites'])[k] as any}
                onChange={v =>
                  update(c => {
                    const sh = (c.home.shelves ?? ['notes', 'docs', 'favourites']).slice(0, 3);
                    sh[k] = v;
                    c.home.shelves = sh;
                  })
                }
              />
            </View>
          ))}
        </Card>

        <Card title="Favourites" note="The notes, documents and folders on the Favourites page, in this order.">
          {favPaths.map((p, k) => (
            <View key={p} style={{minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#cccccc'}}>
              <Text style={{fontSize: T.body, color: INK, flex: 1}} numberOfLines={1}>
                {baseName(p)}
              </Text>
              <Btn label="↑" disabled={k === 0} onPress={() => editZone('favourites', z => void ([z.paths[k - 1], z.paths[k]] = [z.paths[k], z.paths[k - 1]]))} />
              <Btn label="↓" disabled={k === favPaths.length - 1} onPress={() => editZone('favourites', z => void ([z.paths[k + 1], z.paths[k]] = [z.paths[k], z.paths[k + 1]]))} />
              <Btn label="Remove" onPress={() => editZone('favourites', z => void z.paths.splice(k, 1))} />
            </View>
          ))}
          <View style={[st.row, {marginTop: 12}]}>
            <Btn label="Add a note or document" onPress={() => setPicker({kind: 'favourite-file'})} />
            <Btn label="Add a folder" onPress={() => setPicker({kind: 'favourite-folder'})} />
          </View>
        </Card>

        <Card title="Starred pages and keywords" note="The folders SuperHub looks through for pages with a drawn star and for keywords. None chosen = the whole Note folder.">
          {scanFolders.map((p, k) => (
            <View key={p} style={{minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#cccccc'}}>
              <Text style={{fontSize: T.body, color: INK, flex: 1}} numberOfLines={1}>
                {short(p)}
              </Text>
              <Btn label="Remove" onPress={() => setScanFolders(f => void f.splice(k, 1))} />
            </View>
          ))}
          <View style={[st.row, {marginTop: 12}]}>
            <Btn label="Add a folder" onPress={() => setPicker({kind: 'scan-folder'})} />
          </View>
          <Text style={st.label}>Look again for new stars and keywords</Text>
          <Choice
            options={[
              {v: 'open', label: 'Every time'},
              {v: '6', label: 'After 6 hours'},
              {v: '24', label: 'Once a day'},
              {v: 'off', label: 'Only when I tap ↻'},
            ]}
            value={cfg.scan.autoOnOpen ? 'open' : cfg.scan.autoRefreshHours === 0 ? 'off' : String(cfg.scan.autoRefreshHours)}
            onChange={v =>
              update(c => {
                c.scan.autoOnOpen = v === 'open';
                if (v !== 'open') c.scan.autoRefreshHours = v === 'off' ? 0 : Number(v);
              })
            }
          />
        </Card>

        <Card title="Note Clips" note="In a note, lasso something and tap “SuperHub-v3 Clip” in the lasso toolbar to keep it on the Note Clips page (“SuperHub-v3 To-do” makes it a task).">
          <Text style={st.label}>Mark the clipped area on the note</Text>
          <Choice options={[{v: 'off', label: 'No'}, {v: 'grey', label: 'Grey frame'}, {v: 'black', label: 'Black frame'}]} value={cfg.clipFrame ?? 'off'} onChange={v => update(c => void (c.clipFrame = v))} />
          <Text style={st.label}>Keep clips as</Text>
          <Choice options={[{v: 'hand', label: 'Handwriting'}, {v: 'ocr', label: 'Typed text'}]} value={cfg.clipText ?? 'hand'} onChange={v => update(c => void (c.clipText = v))} />
          <Text style={st.label}>When pasting a clip, add a link back to where it came from</Text>
          <Choice options={[{v: 'on', label: 'Yes'}, {v: 'off', label: 'No'}]} value={cfg.clipBacklink === false ? 'off' : 'on'} onChange={v => update(c => void (c.clipBacklink = v === 'on'))} />
        </Card>

        <Card title="Text size on SuperHub pages" note="For Favourites, Starred pages, Keywords, Search, Note Clips and To-do.">
          <Choice options={(['M', 'L', 'XL'] as TextScale[]).map(s => ({v: s, label: s === 'M' ? 'Normal' : s === 'L' ? 'Large' : 'Extra large'}))} value={cfg.textScale} onChange={v => update(c => void (c.textScale = v))} />
        </Card>

        <Card title="Floating home button" note="The small house that floats over every screen. Tap it to open SuperHub; drag it to move it. Turn it off to open SuperHub from the note toolbar only.">
          <Choice
            options={[{v: 'icon', label: 'Show'}, {v: 'off', label: 'Hide'}]}
            value={cfg.bubble.mode}
            onChange={v => {
              update(c => void (c.bubble.mode = v));
              if (v === 'off') DashboardNative.hideBubble?.().catch(() => {});
            }}
          />
        </Card>

        <Card title="Saved copies of your settings" note="Keep a named copy of everything above and bring it back after a reset or on another Supernote.">
          <View style={st.row}>
            <Btn label="Open saved copies" onPress={() => setPicker({kind: 'backups'})} />
            <Btn label="Empty all buttons" onPress={() => update(c => void (c.home.dock = JSON.parse(JSON.stringify(DEFAULT_HOME.dock))))} />
          </View>
        </Card>

        <Card title="Troubleshooting" note="Keep a technical log in MyStyle/Plugins/SuperHub-v3 to attach to a bug report.">
          <Choice options={[{v: 'off', label: 'No log'}, {v: 'on', label: 'Keep a log'}]} value={cfg.debugLog === true ? 'on' : 'off'} onChange={v => update(c => void (c.debugLog = v === 'on'))} />
        </Card>

        <Text style={[st.p, {textAlign: 'center', marginTop: 4, marginBottom: 30}]}>
          SuperHub is based on SuperDashboard by AgP42 (MIT licence). If you enjoy it, AgP42 welcomes support at ko-fi.com/agp42.
        </Text>
      </ScrollView>
    </View>
  );
}
