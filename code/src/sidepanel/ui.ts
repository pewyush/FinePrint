/** Tiny element builder — no innerHTML anywhere, page text only ever becomes textContent. */

export type Child = Node | string | number | null | undefined | false;

export interface ElementProps {
  class?: string;
  id?: string;
  text?: string;
  title?: string;
  href?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  checked?: boolean;
  readOnly?: boolean;
  dataset?: Record<string, string>;
  onClick?: (event: MouseEvent) => void;
  onChange?: (event: Event) => void;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag) as HTMLElement;
  if (props.class) element.className = props.class;
  if (props.id) element.id = props.id;
  if (props.text !== undefined) element.textContent = props.text;
  if (props.title !== undefined) element.title = props.title;
  if (props.href !== undefined) element.setAttribute("href", props.href);
  if (props.type !== undefined) element.setAttribute("type", props.type);
  if (props.value !== undefined) (element as HTMLInputElement).value = props.value;
  if (props.placeholder !== undefined) (element as HTMLInputElement).placeholder = props.placeholder;
  if (props.disabled !== undefined) (element as HTMLButtonElement).disabled = props.disabled;
  if (props.checked !== undefined) (element as HTMLInputElement).checked = props.checked;
  if (props.readOnly !== undefined) (element as HTMLInputElement).readOnly = props.readOnly;
  if (props.dataset) {
    for (const [key, value] of Object.entries(props.dataset)) element.dataset[key] = value;
  }
  if (props.onClick) element.addEventListener("click", props.onClick as EventListener);
  if (props.onChange) element.addEventListener("change", props.onChange as EventListener);

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === "string" || typeof child === "number" ? String(child) : child);
  }
  return element as HTMLElementTagNameMap[K];
}

export function clear(element: Element): void {
  while (element.firstChild) element.removeChild(element.firstChild);
}

export function replace(element: Element, ...children: Child[]): void {
  clear(element);
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === "string" || typeof child === "number" ? String(child) : child);
  }
}
