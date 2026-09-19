export type LifeOrigin = { width: number; height: number; transform: string; fontSize: string; visibleWidth: number; visibleHeight: number };

/** Preserve the visible z=0 plane without the camera's reflected depth axis. */
export function flattenScreenProjection(matrix: ArrayLike<number>): number[] {
  const w = matrix[15];
  // CSS interpolates decomposed transforms. Keeping WebGL's depth here makes
  // an upright screen flip while transitioning to a flat, positive-scale view.
  return [
    matrix[0] / w, matrix[1] / w, 0, matrix[3] / w,
    matrix[4] / w, matrix[5] / w, 0, matrix[7] / w,
    0, 0, 1, 0,
    matrix[12] / w, matrix[13] / w, 0, 1,
  ];
}

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
    transform = new DOMMatrix(flattenScreenProjection(transform.toFloat64Array()));
  } else {
    const rect = button.getBoundingClientRect();
    transform = new DOMMatrix().translate(rect.left, rect.top).scale(rect.width / width, rect.height / height);
  }
  const rect = button.getBoundingClientRect();
  return { width, height, transform: transform.toString(), fontSize: getComputedStyle(button).fontSize, visibleWidth: rect.width, visibleHeight: rect.height };
}
