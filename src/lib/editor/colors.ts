/** Heading colours offered in the palette (undefined = default gray). */
export const TABLE_COLORS = [
	'#fde2e2', '#fde7c8', '#fef3c7', '#dcfce7', '#ccfbf1', '#dbeafe',
	'#e0e7ff', '#f3e8ff', '#fce7f3', '#2f6fde', '#1a7f37', '#6e40c9'
];

/** Black or white, whichever reads better on the given #rrggbb background. */
export function textOn(hex: string) {
	const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (!m) return undefined;
	const [r, g, b] = m.slice(1).map((h) => {
		const c = parseInt(h, 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return luminance > 0.4 ? '#1f2328' : '#ffffff';
}
