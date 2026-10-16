<script lang="ts">
	import type { BoardContent } from '$lib/types';
	import { parseImport } from './parse';
	import { findConflicts, planImport, type ConflictPolicy, type ImportPlan } from './plan';

	let {
		board,
		defaultTarget = 'new',
		onimport,
		onclose
	}: {
		board: BoardContent;
		defaultTarget?: string;
		onimport: (plan: ImportPlan) => void;
		onclose: () => void;
	} = $props();

	let text = $state('');
	// svelte-ignore state_referenced_locally
	let target = $state(defaultTarget);
	let policy = $state<ConflictPolicy>('skip');
	let copied = $state(false);
	let dragging = $state(false);

	let parsed = $derived(text.trim() ? parseImport(text) : null);
	let multi = $derived(parsed?.ok ? parsed.pages.length > 1 : false);
	let effectiveTarget = $derived(multi ? 'new' : target);
	let conflicts = $derived(parsed?.ok ? findConflicts(parsed.pages, effectiveTarget, board) : []);
	let planned = $derived(parsed?.ok ? planImport(parsed.pages, effectiveTarget, policy, board) : null);
	let errors = $derived(parsed && !parsed.ok ? parsed.errors : planned && !planned.ok ? planned.errors : []);

	async function readFile(file: File | undefined) {
		if (file) text = await file.text();
	}

	async function copyPrompt() {
		const schema = await fetch('/board-import.schema.json').then((r) => r.text());
		const prompt = `I use a data-modelling app that imports JSON. Produce ONE JSON document that follows the JSON Schema below exactly (no extra properties, no comments, no explanation — only the JSON).

Rules:
- A page has "page" (title), "tables" and "relations". Use { "pages": [...] } only if I ask for several pages.
- Each table has a unique "name" and "columns" with "name", "type" and optional "key" ("PK", "FK" or "PK+FK"). Composite primary keys = several PK columns.
- Relations connect two columns on the same page: "from" is the referencing (FK) column, "to" the referenced column, written as "table.column". Add "fromCardinality"/"toCardinality" (one, zero-or-one, one-or-many, zero-or-many) when they differ from the default many-to-one.
- Leave out "x", "y" and "size": the app lays the tables out automatically.

JSON Schema:
${schema}

My model: <describe your model here>`;
		try {
			await navigator.clipboard.writeText(prompt);
		} catch {
			const ta = Object.assign(document.createElement('textarea'), { value: prompt });
			document.body.append(ta);
			ta.select();
			document.execCommand('copy');
			ta.remove();
		}
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function submit() {
		if (planned?.ok) onimport(planned.plan);
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
	<header>
		<h2 id="import-title">Import JSON</h2>
		<div class="links">
			<button onclick={copyPrompt} title="Copy a prompt that tells ChatGPT/Claude how to write this JSON">
				{copied ? 'Copied ✓' : '🤖 Copy AI prompt'}
			</button>
			<a href="/board-import.schema.json" download="board-import.schema.json">JSON schema</a>
		</div>
	</header>

	<textarea
		class:dragging
		bind:value={text}
		spellcheck="false"
		placeholder={'Paste JSON here, or drop a .json file…\n\n{\n  "page": "Sales",\n  "tables": [ { "name": "customer", "columns": [ { "name": "id", "type": "integer", "key": "PK" } ] } ],\n  "relations": []\n}'}
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={(e) => {
			e.preventDefault();
			dragging = false;
			readFile(e.dataTransfer?.files[0]);
		}}
	></textarea>

	<div class="row">
		<label class="file">
			<input type="file" accept=".json,application/json" onchange={(e) => readFile(e.currentTarget.files?.[0])} />
			📂 Choose file…
		</label>
		<label>
			Import into
			<select bind:value={target} disabled={multi}>
				<option value="new">{multi ? 'New pages' : 'A new page'}</option>
				{#each board.pages as p (p.id)}<option value={p.id}>Page "{p.title}"</option>{/each}
			</select>
		</label>
	</div>

	{#if conflicts.length}
		<fieldset>
			<legend>Already on this page: {conflicts.join(', ')}</legend>
			<label><input type="radio" bind:group={policy} value="skip" /> Skip them (keep the existing tables)</label>
			<label><input type="radio" bind:group={policy} value="replace" /> Replace them</label>
			<label><input type="radio" bind:group={policy} value="copy" /> Add copies (<code>name_2</code>)</label>
		</fieldset>
	{/if}

	{#if errors.length}
		<div class="errors" role="alert">
			<strong>{errors.length} problem{errors.length === 1 ? '' : 's'} — nothing will be imported:</strong>
			<ul>
				{#each errors.slice(0, 50) as err, i (i)}<li>{err}</li>{/each}
			</ul>
		</div>
	{:else if planned?.ok}
		<p class="preview">✓ {planned.plan.summary}</p>
	{/if}

	<footer>
		<button onclick={onclose}>Cancel</button>
		<button class="primary" disabled={!planned?.ok} onclick={submit}>Import</button>
	</footer>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 0.3);
		z-index: 50;
	}
	.dialog {
		position: fixed;
		z-index: 51;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(720px, calc(100vw - 32px));
		max-height: calc(100vh - 32px);
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: var(--surface);
		border-radius: 12px;
		padding: 18px;
		box-shadow: 0 10px 40px rgb(0 0 0 / 0.25);
		user-select: text;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	h2 {
		margin: 0;
		font-size: 18px;
	}
	.links {
		display: flex;
		gap: 10px;
		align-items: center;
		font-size: 13px;
	}
	a {
		color: var(--accent);
	}
	textarea {
		height: 280px;
		resize: vertical;
		font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		padding: 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
	}
	textarea.dragging {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 8%, var(--bg));
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.file input {
		display: none;
	}
	.file {
		cursor: pointer;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 4px 10px;
	}
	.file:hover {
		background: var(--focus-bg);
	}
	fieldset {
		border: 1px solid var(--border);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
	}
	legend {
		font-weight: 600;
	}
	.errors {
		color: var(--danger);
		background: color-mix(in srgb, var(--danger) 8%, transparent);
		border-radius: 8px;
		padding: 8px 12px;
		font-size: 13px;
	}
	.errors ul {
		margin: 6px 0 0;
		padding-left: 18px;
		max-height: 160px;
		overflow: auto;
	}
	.preview {
		margin: 0;
		color: #1a7f37;
		font-size: 14px;
	}
	footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
