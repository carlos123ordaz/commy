type SortableTable = {
  zone?: string | null;
  number?: number | null;
  name: string;
};

function compareText(left?: string | null, right?: string | null): number {
  return (left ?? '').localeCompare(right ?? '', undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function sortTablesByDisplayOrder<T extends SortableTable>(tables: T[]): T[] {
  return [...tables].sort((left, right) => {
    const byZone = compareText(left.zone, right.zone);
    if (byZone !== 0) return byZone;

    const leftHasNumber = typeof left.number === 'number';
    const rightHasNumber = typeof right.number === 'number';

    if (leftHasNumber && rightHasNumber && left.number !== right.number) {
      return left.number! - right.number!;
    }

    if (leftHasNumber !== rightHasNumber) {
      return leftHasNumber ? -1 : 1;
    }

    const byName = compareText(left.name, right.name);
    if (byName !== 0) return byName;

    return 0;
  });
}
