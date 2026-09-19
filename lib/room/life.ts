export type LifeOrigin = { width: number; height: number; transform: string; fontSize: string; visibleWidth: number; visibleHeight: number };

export function captureLifeOrigin(button: HTMLElement, pane: HTMLElement, room: HTMLElement): LifeOrigin {
  const width = button.offsetWidth;
  const height = button.offsetHeight;
  let transform: DOMMatrix;
  if (room.dataset.projected === "true") {
    let x = 0;
    let y = 0;
    let element: HTMLElement | null = button;
    while (element && element !== pane) {
      x += element.offsetLeft;
      y += element.offsetTop;
      element = element.offsetParent as HTMLElement | null;
    }
    const rect = room.getBoundingClientRect();
    transform = new DOMMatrix().translate(rect.left, rect.top)
      .multiply(new DOMMatrix(pane.style.transform)).translate(x, y);
  } else {
    const rect = button.getBoundingClientRect();
    transform = new DOMMatrix().translate(rect.left, rect.top).scale(rect.width / width, rect.height / height);
  }
  const rect = button.getBoundingClientRect();
  return { width, height, transform: transform.toString(), fontSize: getComputedStyle(button).fontSize, visibleWidth: rect.width, visibleHeight: rect.height };
}
