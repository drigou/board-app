<script lang="ts">
	// Crow's foot markers. Drawn for the *end* of a line (the endpoint at x=24, path entering from the left);
	// `auto-start-reverse` flips them automatically when used as a start marker.
	const variants = [
		{ suffix: '', color: 'var(--edge)' },
		{ suffix: '-sel', color: 'var(--accent)' }
	];
</script>

<svg width="0" height="0" style="position: absolute" aria-hidden="true">
	<defs>
		{#each variants as v (v.suffix)}
			<marker id="card-one{v.suffix}" viewBox="0 0 24 20" markerWidth="24" markerHeight="20" refX="24" refY="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
				<g stroke={v.color} stroke-width="1.5" fill="none">
					<line x1="14" y1="3" x2="14" y2="17" />
					<line x1="18" y1="3" x2="18" y2="17" />
				</g>
			</marker>
			<marker id="card-zero-or-one{v.suffix}" viewBox="0 0 24 20" markerWidth="24" markerHeight="20" refX="24" refY="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
				<g stroke={v.color} stroke-width="1.5">
					<line x1="18" y1="3" x2="18" y2="17" />
					<circle cx="9" cy="10" r="4" fill="var(--page)" />
				</g>
			</marker>
			<marker id="card-one-or-many{v.suffix}" viewBox="0 0 24 20" markerWidth="24" markerHeight="20" refX="24" refY="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
				<g stroke={v.color} stroke-width="1.5" fill="none">
					<line x1="10" y1="3" x2="10" y2="17" />
					<line x1="13" y1="10" x2="24" y2="2" />
					<line x1="13" y1="10" x2="24" y2="18" />
				</g>
			</marker>
			<marker id="card-zero-or-many{v.suffix}" viewBox="0 0 24 20" markerWidth="24" markerHeight="20" refX="24" refY="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
				<g stroke={v.color} stroke-width="1.5">
					<line x1="13" y1="10" x2="24" y2="2" />
					<line x1="13" y1="10" x2="24" y2="18" />
					<circle cx="7" cy="10" r="4" fill="var(--page)" />
				</g>
			</marker>
		{/each}
	</defs>
</svg>
