import type { ModuleType } from '../domain/types';

/** Small vector traces are readable at every zoom level and need no image assets. */
export function Waveform({
  type = 'oscillator',
  waveform = 'sine',
}: {
  type?: ModuleType;
  waveform?: string;
}) {
  let path =
    'M0 26 C8 0 16 0 24 26 S40 52 48 26 S64 0 72 26 S88 52 96 26 S112 0 120 26 S136 52 144 26 S160 0 168 26 S184 52 192 26';
  if (waveform === 'sawtooth')
    path =
      'M0 40 L28 10 L28 42 L60 10 L60 42 L92 10 L92 42 L124 10 L124 42 L156 10 L156 42 L188 10 L188 42';
  if (waveform === 'square')
    path = 'M0 40 H16 V12 H40 V40 H64 V12 H88 V40 H112 V12 H136 V40 H160 V12 H184 V40 H192';
  if (waveform === 'triangle') path = 'M0 26 L16 8 L48 44 L80 8 L112 44 L144 8 L176 44 L192 26';
  if (type === 'noise')
    path =
      'M0 26L5 15 10 33 15 5 20 40 25 20 30 35 35 13 40 31 45 5 50 39 55 26 60 15 65 37 70 11 75 31 80 3 85 39 90 25 95 43 100 13 105 33 110 5 115 41 120 16 125 31 130 7 135 38 140 25 145 4 150 43 155 28 160 17 165 35 170 6 175 37 180 19 185 32 192 26';
  if (type === 'filter')
    path = 'M0 39 H40 C80 39 93 39 105 16 C111 5 120 7 126 22 C136 42 154 43 192 45';
  if (type === 'delay')
    path =
      'M0 26 Q8 0 16 26 T32 26 M45 26 Q53 7 61 26 T77 26 M90 26 Q98 13 106 26 T122 26 M135 26 Q143 18 151 26 T167 26 M180 26 Q186 22 192 26';
  if (type === 'drum-machine')
    path = 'M0 35H12V8H24V35H42V20H54V35H72V12H84V35H102V24H114V35H132V8H144V35H162V20H174V35H192';
  if (type === 'drum-kit')
    path =
      'M8 6H50V46H8ZM70 6H112V46H70ZM132 6H174V46H132ZM18 16H40M80 16H102M142 16H164M18 29H40M80 29H102M142 29H164';
  if (type === 'keyboard')
    path =
      'M8 4H184V48H8ZM33 4V48M58 4V48M83 4V48M108 4V48M133 4V48M158 4V48M28 4V28H38V4M53 4V28H63V4M103 4V28H113V4M128 4V28H138V4M153 4V28H163V4';
  if (type === 'pad-controller')
    path =
      'M18 3H48V21H18ZM60 3H90V21H60ZM102 3H132V21H102ZM144 3H174V21H144ZM18 31H48V49H18ZM60 31H90V49H60ZM102 31H132V49H102ZM144 31H174V49H144Z';
  if (type === 'merger')
    path = 'M8 6H52L96 26H176M8 19H52L96 26M8 33H52L96 26M8 46H52L96 26M165 17L178 26L165 35';
  if (type === 'switch')
    path = 'M8 6H56M8 19H56M8 33H56M8 46H56M56 19L112 26H184M172 16L184 26L172 36';
  return (
    <svg viewBox="0 0 192 52" fill="none" aria-hidden="true">
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
