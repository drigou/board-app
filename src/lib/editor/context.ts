import { getContext, setContext } from 'svelte';
import type { Editor } from './editor.svelte';

const KEY = Symbol('editor');
export const setEditor = (editor: Editor) => setContext(KEY, editor);
export const getEditor = () => getContext<Editor>(KEY);
