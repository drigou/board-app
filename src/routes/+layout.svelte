<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { boards } from '$lib/boards.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';

	let { children } = $props();

	onMount(() => {
		boards.refresh();
	});
</script>

<div class="app">
	<Sidebar />
	<main>{@render children()}</main>
</div>

<style>
	.app {
		display: flex;
		height: 100vh;
	}
	main {
		flex: 1;
		min-width: 0;
		position: relative;
	}
</style>
