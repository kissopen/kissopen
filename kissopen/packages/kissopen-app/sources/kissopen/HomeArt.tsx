import * as React from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

/*
 * The drawn pictures of the home, work and project board pages — the same
 * drawings the desktop app uses. A demonstration of somebody's work must not
 * show real people or real products, and a drawing reads as "an example" in a
 * way a stock photo does not.
 */

const SKIN = ['#F2C9A8', '#E8B48E', '#C98E66', '#F6D5BC', '#D9A27A'];
const HAIR = ['#2B2522', '#4A3326', '#1F1B24', '#6B4632', '#3A2A20'];
const SHIRT = ['#7C6BE0', '#5FB38A', '#F2A07B', '#6FA3D9', '#C58BD8', '#E5C36A'];
const BACKDROP = ['#EEEAFE', '#E6F4EC', '#FDEEE6', '#E8F0FA', '#F6ECFA', '#FBF4DF'];

/** A made-up person, the same one for the same seed. */
export const PersonAvatar = React.memo(function PersonAvatar(props: { seed: number; size: number }) {
    const seed = props.seed;
    const skin = SKIN[seed % SKIN.length]!;
    const hair = HAIR[(seed * 3) % HAIR.length]!;
    const shirt = SHIRT[(seed * 5) % SHIRT.length]!;
    const back = BACKDROP[seed % BACKDROP.length]!;
    const style = seed % 4;
    return (
        <Svg width={props.size} height={props.size} viewBox="0 0 64 64">
            <Circle cx="32" cy="32" r="32" fill={back} />
            {style === 1 && <Path d="M14 34c0-14 8-22 18-22s18 8 18 22v14H14z" fill={hair} />}
            <Path d="M12 64c1-12 9-19 20-19s19 7 20 19z" fill={shirt} />
            <Rect x="27" y="36" width="10" height="10" rx="4" fill={skin} />
            <Ellipse cx="32" cy="29" rx="11" ry="12.5" fill={skin} />
            {style === 0 && <Path d="M20.5 27c0-9 5-13.5 11.5-13.5S43.5 18 43.5 27c-3-5-7-6.5-11.5-6.5S23.5 22 20.5 27z" fill={hair} />}
            {style === 1 && <Path d="M20.5 28c0-9 5-14.5 11.5-14.5S43.5 19 43.5 28c-2-6-6-8.5-11.5-8.5S22.5 22 20.5 28z" fill={hair} />}
            {style === 2 && <>
                <Circle cx="32" cy="12.5" r="5.5" fill={hair} />
                <Path d="M20.5 27c0-9 5-13.5 11.5-13.5S43.5 18 43.5 27c-4-4-7-5.5-11.5-5.5S24.5 23 20.5 27z" fill={hair} />
            </>}
            {style === 3 && <Path d="M19 29c-1-11 5-17 13-17s14 6 13 17c-2-2-2-6-5-7-2 3-6 3-9 2-3 2-6 2-9 1-1 1-2 3-3 4z" fill={hair} />}
            <Circle cx="27.5" cy="30" r="1.3" fill="#2B2522" />
            <Circle cx="36.5" cy="30" r="1.3" fill="#2B2522" />
            <Path d="M29 35.5c1.8 1.4 4.2 1.4 6 0" stroke="#A8664A" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </Svg>
    );
});

/** A small still life for a project: the server names one of these kinds. */
export const ProjectPicture = React.memo(function ProjectPicture(props: { kind: string; width: number; height: number }) {
    return (
        <Svg width={props.width} height={props.height} viewBox="0 0 96 72" preserveAspectRatio="xMidYMid slice">
            {PICTURES[props.kind] ?? PICTURES.document}
        </Svg>
    );
});

const PICTURES: Record<string, React.ReactNode> = {
    sneakers: <>
        <Rect width="96" height="72" fill="#EFEDF3" />
        <Ellipse cx="48" cy="56" rx="34" ry="4" fill="#DAD6E1" />
        <Path d="M16 50c0-8 6-14 14-15l10-9c3-3 8-3 11 0l6 6c6 5 14 8 22 10 4 1 6 4 6 8H16z" fill="#FFFFFF" stroke="#CFCAD8" />
        <Path d="M16 50h69v5H18c-1 0-2-1-2-2z" fill="#E3DFEA" />
        <Path d="M38 30l6 6M42 27l6 6M46 25l5 5" stroke="#B9B2C6" strokeWidth="1.6" strokeLinecap="round" />
    </>,
    cup: <>
        <Rect width="96" height="72" fill="#F4EEE7" />
        <Ellipse cx="48" cy="56" rx="26" ry="5" fill="#E6DCCF" />
        <Path d="M30 30h32v14c0 7-6 12-13 12h-6c-7 0-13-5-13-12z" fill="#FFFFFF" stroke="#DDD2C4" />
        <Path d="M62 34h4c4 0 6 3 6 6s-2 6-6 6h-5" fill="none" stroke="#DDD2C4" strokeWidth="3" />
        <Ellipse cx="46" cy="30" rx="16" ry="3.5" fill="#B98C63" />
        <Path d="M42 14c-2 3 2 5 0 8M50 12c-2 3 2 5 0 8" stroke="#D7C6B3" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>,
    boxes: <>
        <Rect width="96" height="72" fill="#EFE7DC" />
        <Rect x="14" y="34" width="30" height="24" fill="#C8A175" />
        <Rect x="46" y="34" width="30" height="24" fill="#BD9467" />
        <Rect x="30" y="12" width="30" height="22" fill="#D2AE82" />
        <Path d="M14 40h30M46 40h30M30 18h30" stroke="#A97F55" strokeWidth="1.4" />
        <Rect x="26" y="34" width="6" height="6" fill="#E8D6BD" />
        <Rect x="58" y="34" width="6" height="6" fill="#E8D6BD" />
    </>,
    laptop: <>
        <Rect width="96" height="72" fill="#E9EDF6" />
        <Rect x="22" y="16" width="52" height="32" rx="3" fill="#2F3447" />
        <Rect x="26" y="20" width="44" height="24" rx="1.5" fill="#8FA7E8" />
        <Path d="M30 38l8-7 6 5 8-9 10 11" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <Path d="M16 50h64l-4 6H20z" fill="#C7CDDC" />
    </>,
    document: <>
        <Rect width="96" height="72" fill="#EEEAFB" />
        <Rect x="30" y="10" width="36" height="48" rx="3" fill="#FFFFFF" stroke="#D5CEF2" />
        <Rect x="36" y="18" width="18" height="3" rx="1.5" fill="#8C7BE0" />
        <Rect x="36" y="26" width="24" height="2.5" rx="1.25" fill="#D9D3F3" />
        <Rect x="36" y="32" width="24" height="2.5" rx="1.25" fill="#D9D3F3" />
        <Rect x="36" y="38" width="16" height="2.5" rx="1.25" fill="#D9D3F3" />
        <Circle cx="62" cy="54" r="8" fill="#8C7BE0" />
        <Path d="M58.5 54l2.5 2.5 4.5-5" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>,
    chart: <>
        <Rect width="96" height="72" fill="#E7F3EC" />
        <Rect x="20" y="40" width="10" height="16" rx="2" fill="#9AD0B0" />
        <Rect x="36" y="30" width="10" height="26" rx="2" fill="#6FBF92" />
        <Rect x="52" y="22" width="10" height="34" rx="2" fill="#4BA876" />
        <Rect x="68" y="14" width="10" height="42" rx="2" fill="#2F8F5E" />
        <Path d="M18 34l16-10 16 4 22-14" stroke="#F2A07B" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </>,
    megaphone: <>
        <Rect width="96" height="72" fill="#FDEEE6" />
        <Path d="M28 30l30-12v36L28 42z" fill="#F2A07B" />
        <Rect x="20" y="29" width="10" height="14" rx="3" fill="#E48460" />
        <Path d="M32 42l4 12h6l-3-11" fill="#E48460" />
        <Path d="M64 28c4 2 4 14 0 16M70 24c7 4 7 20 0 24" stroke="#E9B39A" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </>,
    calendar: <>
        <Rect width="96" height="72" fill="#EAF0FA" />
        <Rect x="24" y="14" width="48" height="44" rx="5" fill="#FFFFFF" stroke="#CBD7EC" />
        <Rect x="24" y="14" width="48" height="11" rx="5" fill="#6FA3D9" />
        <Path d="M36 10v8M60 10v8" stroke="#46709E" strokeWidth="3" strokeLinecap="round" />
        {[0, 1, 2, 3].map(column => [0, 1, 2].map(row => (
            <Rect key={`${column}-${row}`} x={30 + column * 10} y={30 + row * 8} width="6" height="5" rx="1" fill={column === 2 && row === 1 ? '#F2A07B' : '#D9E3F3'} />
        )))}
    </>,
    bag: <>
        <Rect width="96" height="72" fill="#F6ECFA" />
        <Path d="M28 26h40l-4 32H32z" fill="#C58BD8" />
        <Path d="M38 26c0-8 4-12 10-12s10 4 10 12" stroke="#9E62B4" strokeWidth="3" fill="none" />
        <Rect x="40" y="36" width="16" height="3" rx="1.5" fill="#F3DDF8" />
    </>,
    plant: <>
        <Rect width="96" height="72" fill="#EAF6EE" />
        <Path d="M36 44h24l-3 14H39z" fill="#E3B48F" />
        <Path d="M48 44V26" stroke="#3B8C5E" strokeWidth="2.4" />
        <Path d="M48 32c-10-2-14-10-12-16 8 1 13 7 12 16zM48 30c8-4 14-2 16 3-6 5-12 3-16-3z" fill="#5FB38A" />
    </>,
};

/**
 * A sunrise over soft hills, laid behind the top of a page or a card. It
 * fills whatever box it is given and keeps its horizon on the bottom edge.
 */
export const Landscape = React.memo(function Landscape(props: { width: number; height: number; id: string; sky?: boolean }) {
    const { theme } = useUnistyles();
    const home = theme.colors.home;
    const sky = props.sky !== false;
    return (
        <Svg width={props.width} height={props.height} viewBox="0 0 420 260" preserveAspectRatio="xMidYMax slice">
            <Defs>
                <LinearGradient id={`${props.id}-sky`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={home.skyTop} stopOpacity={sky ? 1 : 0} />
                    <Stop offset="0.7" stopColor={home.skyBottom} stopOpacity={sky ? 1 : 0} />
                </LinearGradient>
                <RadialGradient id={`${props.id}-sun`} cx="0.5" cy="0.5" r="0.5">
                    <Stop offset="0" stopColor="#FFD9A8" />
                    <Stop offset="1" stopColor="#FFC58F" stopOpacity="0" />
                </RadialGradient>
            </Defs>
            <Rect width="420" height="260" fill={`url(#${props.id}-sky)`} />
            <Circle cx="250" cy="150" r="70" fill={`url(#${props.id}-sun)`} />
            <Circle cx="250" cy="150" r="34" fill={home.sun} opacity={0.85} />
            <Path d="M0 170c50-22 90-30 140-18s80 4 120-10 100-10 160 12v106H0z" fill={home.hillFar} />
            <Path d="M0 196c60-18 110-16 160-4s110 8 150-6 80-6 110 4v70H0z" fill={home.hillMid} />
            <Path d="M0 222c70-12 130-10 200 2s150 6 220-8v44H0z" fill={home.hillNear} />
            <Path d="M300 212l6-18 6 18zM314 214l5-14 5 14zM286 216l4-12 4 12z" fill={home.trees} />
        </Svg>
    );
});

/** A road winding up to a flag: the project board's "most important step". */
export const Road = React.memo(function Road(props: { width: number; height: number }) {
    const { theme } = useUnistyles();
    const home = theme.colors.home;
    return (
        <Svg width={props.width} height={props.height} viewBox="0 0 200 150" preserveAspectRatio="xMaxYMax slice">
            <Circle cx="120" cy="58" r="26" fill={home.sun} opacity={0.7} />
            <Path d="M0 110c40-22 80-26 120-14s60 0 80-10v64H0z" fill={home.hillFar} />
            <Path d="M40 150c30-20 70-26 90-40s30-30 34-48c2 20-6 40-26 54s-50 24-66 34z" fill={theme.colors.home.card} opacity={0.9} />
            <Path d="M0 132c40-10 70-6 100 2s70 4 100-8v24H0z" fill={home.hillMid} />
            <Path d="M160 62V36" stroke={home.peach} strokeWidth="2" strokeLinecap="round" />
            <Path d="M160 36h14l-4 5 4 5h-14z" fill={home.peach} />
            <Path d="M14 128l5-14 5 14zM26 130l4-10 4 10zM176 124l5-14 5 14z" fill={home.trees} />
        </Svg>
    );
});
