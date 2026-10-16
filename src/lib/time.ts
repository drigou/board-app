const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function timeAgo(iso: string, now = Date.now()) {
	const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
	const abs = Math.abs(seconds);
	if (abs < 45) return 'just now';
	if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
	if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
	if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day');
	return new Date(iso).toLocaleDateString();
}
