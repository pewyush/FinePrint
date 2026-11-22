/** Tiny element builder — no innerHTML anywhere, page text only ever becomes textContent. */
export function h(tag, props = {}, children = []) {
    const element = document.createElement(tag);
    if (props.class)
        element.className = props.class;
    if (props.id)
        element.id = props.id;
    if (props.text !== undefined)
        element.textContent = props.text;
    if (props.title !== undefined)
        element.title = props.title;
    if (props.href !== undefined)
        element.setAttribute("href", props.href);
    if (props.type !== undefined)
        element.setAttribute("type", props.type);
    if (props.value !== undefined)
        element.value = props.value;
    if (props.placeholder !== undefined)
        element.placeholder = props.placeholder;
    if (props.disabled !== undefined)
        element.disabled = props.disabled;
    if (props.checked !== undefined)
        element.checked = props.checked;
    if (props.readOnly !== undefined)
        element.readOnly = props.readOnly;
    if (props.dataset) {
        for (const [key, value] of Object.entries(props.dataset))
            element.dataset[key] = value;
    }
    if (props.onClick)
        element.addEventListener("click", props.onClick);
    if (props.onChange)
        element.addEventListener("change", props.onChange);
    for (const child of children) {
        if (child === null || child === undefined || child === false)
            continue;
        element.append(typeof child === "string" || typeof child === "number" ? String(child) : child);
    }
    return element;
}
export function clear(element) {
    while (element.firstChild)
        element.removeChild(element.firstChild);
}
export function replace(element, ...children) {
    clear(element);
    for (const child of children) {
        if (child === null || child === undefined || child === false)
            continue;
        element.append(typeof child === "string" || typeof child === "number" ? String(child) : child);
    }
}
