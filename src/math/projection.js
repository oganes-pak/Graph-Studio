/** Поворот и перспективная проекция. Чистые функции подходят для DDT. */
export function rotatePoint3D(point, angleX, angleY) {
  const cosX = Math.cos(angleX); const sinX = Math.sin(angleX);
  const cosY = Math.cos(angleY); const sinY = Math.sin(angleY);
  const x1 = point.x * cosY - point.z * sinY;
  const z1 = point.z * cosY + point.x * sinY;
  const y2 = point.y * cosX - z1 * sinX;
  const z2 = z1 * cosX + point.y * sinX;
  return { x: x1, y: y2, z: z2 };
}

export function inverseRotateVector(point, angleX, angleY) {
  const cosX = Math.cos(angleX); const sinX = Math.sin(angleX);
  const cosY = Math.cos(angleY); const sinY = Math.sin(angleY);
  const y1 = point.y * cosX + point.z * sinX;
  const z1 = -point.y * sinX + point.z * cosX;
  const x0 = point.x * cosY + z1 * sinY;
  const z0 = -point.x * sinY + z1 * cosY;
  return { x: x0, y: y1, z: z0 };
}

export function projectPoint3D(point, camera, viewport) {
  const denominator = camera.focalLength + point.z;
  if (denominator <= camera.nearClip) return { visible: false, x: 0, y: 0, scale: 0 };
  const scale = camera.focalLength / denominator;
  return {
    visible: true,
    x: viewport.centerX + point.x * scale * camera.zoom,
    y: viewport.centerY + point.y * scale * camera.zoom,
    scale
  };
}
