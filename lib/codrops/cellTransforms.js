window.getCarouselCellTransforms = (count, radius) => {
  const angleStep = 360 / count; // Divide 360° by number of cells to get angle step
  return Array.from({ length: count }, (_, i) => {
    const angle = i * angleStep;
    return `rotateY(calc(${angle}deg + var(--spin, 0deg))) translateZ(calc(${radius}px + var(--spread, 0px) + var(--spin-spread, 0px)))`; // 3D rotation + translation (plus the drag's turn, and the spread from the scroll and drag speed)
  });
};
