/**
 * SuperHub-v3's home screen: a retro handheld console drawn on the plain page.
 * A pixel-art screen shows the clock, date, week and battery; nine console
 * buttons (D-pad up/left/right/down, two pill buttons, B, A and the speaker
 * grille) are the home buttons, each assignable in settings. Empty margins on
 * all four sides leave the Supernote's own bars clear.
 *
 * Laid out on a 960 x 1280 design (half the Manta's pixels) and scaled to fit.
 */
import React, {useEffect, useState} from 'react';
import {Image, NativeModules, Text, TouchableOpacity, View} from 'react-native';

import {DockItem} from './config';
import {pressDock} from './home';
import {leavePlugin} from './bubble';
import {setRoute} from './route';

const {DashboardNative} = NativeModules;
const SCENE = require('../assets/hub/scene.png');
const INK = '#1c1c1c';
const FRAME = '#6a6a6a';

/** Where each of the nine buttons sits, in order of the home buttons list. */
export const SLOT_NAMES = ['D-pad up', 'D-pad left', 'D-pad right', 'D-pad down', 'Left pill', 'Right pill', 'B button', 'A button', 'Speaker'];

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

function useNow(nonce: number) {
  const [now, setNow] = useState(() => new Date());
  const [bat, setBat] = useState<{level: number; charging: boolean} | null>(null);
  useEffect(() => {
    setNow(new Date());
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
  return {now, bat};
}

function batteryBars(level: number): string {
  const n = Math.max(0, Math.min(4, Math.round(level / 25)));
  return '▮'.repeat(n) + '▯'.repeat(4 - n);
}

export function ConsoleHome({items, labels, hour24, nonce, onBlock, onNewNote}: {
  items: DockItem[];
  labels: boolean;
  hour24: boolean;
  nonce: number;
  onBlock: (b: string) => void;
  onNewNote: (d: Extract<DockItem, {kind: 'create'}>) => void;
}) {
  const [box, setBox] = useState({w: 0, h: 0});
  const {now, bat} = useNow(nonce);
  const s = box.w ? Math.min(box.w / 960, box.h / 1280) : 0;
  const ox = (box.w - 960 * s) / 2;
  const oy = (box.h - 1280 * s) / 2;
  const at = (x: number, y: number, w: number, h: number) => ({position: 'absolute' as const, left: ox + x * s, top: oy + y * s, width: w * s, height: h * s});

  let hh = now.getHours();
  const mm = String(now.getMinutes()).padStart(2, '0');
  let ampm = '';
  if (!hour24) {
    ampm = hh < 12 ? 'AM' : 'PM';
    hh = hh % 12 || 12;
  }
  const time = `${hour24 ? String(hh).padStart(2, '0') : hh}:${mm}`;
  const date = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} · WK ${isoWeek(now)}`;
  const battery = bat && bat.level >= 0 ? ` · ${batteryBars(bat.level)} ${bat.level}%` : '';

  const press = (i: number) => items[i] && pressDock(items[i], onBlock, onNewNote);
  const name = (i: number) => (items[i]?.label || (items[i]?.kind === 'none' ? '—' : ''));
  const Label = ({i, x, y, align = 'center', w = 200}: {i: number; x: number; y: number; align?: 'left' | 'center' | 'right'; w?: number}) =>
    labels ? (
      <Text
        numberOfLines={1}
        style={[at(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y, w, 26), {fontSize: 17 * s, fontWeight: '600', color: INK, textAlign: align}]}>
        {name(i)}
      </Text>
    ) : null;

  // D-pad: 168 square, arms 56
  const DX = 149, DY = 812, A = 56;
  const arm = (i: number, x: number, y: number, glyph: string) => (
    <TouchableOpacity key={i} activeOpacity={0.6} onPress={() => press(i)} style={[at(DX + x, DY + y, A, A), {backgroundColor: INK, alignItems: 'center', justifyContent: 'center'}]}>
      <Text style={{color: '#8a8a8a', fontSize: 18 * s}}>{glyph}</Text>
    </TouchableOpacity>
  );
  const round = (i: number, x: number, y: number, letter: string) => (
    <TouchableOpacity key={i} activeOpacity={0.6} onPress={() => press(i)} style={[at(x, y, 108, 108), {borderRadius: 54 * s, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center'}]}>
      <Text style={{color: '#ffffff', fontSize: 26 * s, fontWeight: '700'}}>{letter}</Text>
    </TouchableOpacity>
  );
  const pill = (i: number, x: number, y: number) => (
    <TouchableOpacity key={i} activeOpacity={0.6} onPress={() => press(i)} hitSlop={{top: 20, bottom: 20, left: 10, right: 10}} style={[at(x, y, 100, 28), {borderRadius: 14 * s, backgroundColor: '#8a8a8a', borderWidth: 2 * s, borderColor: '#333333', transform: [{rotate: '-24deg'}]}]} />
  );

  return (
    <View style={{flex: 1, backgroundColor: '#ffffff'}} onLayout={e => setBox({w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height})}>
      {s > 0 && (
        <>
          {/* screen frame: rounded, big curve bottom right */}
          <View style={[at(149, 120, 662, 560), {backgroundColor: FRAME, borderRadius: 36 * s, borderBottomRightRadius: 120 * s}]} />
          {/* power light: tap to close SuperHub */}
          <TouchableOpacity onPress={() => leavePlugin()} hitSlop={{top: 24, bottom: 24, left: 24, right: 24}} style={[at(183, 382, 16, 16), {borderRadius: 8 * s, backgroundColor: INK}]} />
          {/* the game screen with the clock in its sky */}
          <View style={[at(233, 166, 494, 456), {borderRadius: 14 * s, overflow: 'hidden', backgroundColor: '#eeeeee'}]}>
            <Image source={SCENE} style={{width: '100%', height: '100%'}} resizeMode="stretch" fadeDuration={0} />
            <View style={{position: 'absolute', left: 0, right: 0, top: 30 * s, alignItems: 'center'}}>
              <Text style={{fontFamily: 'monospace', fontWeight: '700', fontSize: 92 * s, lineHeight: 96 * s, color: '#181818', letterSpacing: 2 * s}}>
                {time}
                {ampm ? <Text style={{fontSize: 30 * s}}> {ampm}</Text> : null}
              </Text>
              <Text style={{fontFamily: 'monospace', fontWeight: '700', fontSize: 19 * s, color: '#181818', marginTop: 6 * s}}>
                {date}
                {battery}
              </Text>
            </View>
          </View>
          {/* the name plate: tap for settings */}
          <TouchableOpacity onPress={() => setRoute('config')} style={at(149, 690, 260, 40)}>
            <Text style={{fontSize: 22 * s, fontWeight: '600', color: '#444444', letterSpacing: 6 * s}}>SUPERHUB</Text>
          </TouchableOpacity>

          {/* D-pad */}
          <View style={[at(DX + A, DY + A, A, A), {backgroundColor: INK}]} />
          {arm(0, A, 0, '▲')}
          {arm(1, 0, A, '◀')}
          {arm(2, 2 * A, A, '▶')}
          {arm(3, A, 2 * A, '▼')}
          <Label i={0} x={DX + 84} y={DY - 32} />
          <Label i={1} x={DX - 10} y={DY + 72} align="right" w={140} />
          <Label i={2} x={DX + 178} y={DY + 72} align="left" w={140} />
          <Label i={3} x={DX + 84} y={DY + 174} />

          {/* pills */}
          {pill(4, 350, 1041)}
          {pill(5, 480, 1041)}
          <Label i={4} x={400} y={1086} w={130} />
          <Label i={5} x={530} y={1086} w={130} />

          {/* B and A */}
          {round(6, 563, 876, 'B')}
          {round(7, 703, 806, 'A')}
          <Label i={6} x={617} y={990} w={150} />
          <Label i={7} x={757} y={920} w={150} />

          {/* speaker grille */}
          <TouchableOpacity activeOpacity={0.6} onPress={() => press(8)} style={[at(620, 1004, 250, 150), {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', transform: [{rotate: '-24deg'}]}]}>
            {Array.from({length: 6}).map((_, k) => (
              <View key={k} style={{width: 14 * s, height: 120 * s, borderRadius: 7 * s, backgroundColor: '#555555', marginHorizontal: 8 * s}} />
            ))}
          </TouchableOpacity>
          <Label i={8} x={760} y={1170} w={180} />
        </>
      )}
    </View>
  );
}
