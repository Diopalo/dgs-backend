'use strict';

const {
  parsePaginationParams,
  buildPaginationMeta,
  applyPagination,
  encodeCursor,
  decodeCursor,
  buildNextCursor,
} = require('../../src/utils/pagination');

describe('parsePaginationParams', () => {
  test('valeurs par défaut', () => {
    const p = parsePaginationParams({});
    expect(p.page).toBe(1);
    expect(p.limit).toBe(20);
    expect(p.cursor).toBeNull();
  });

  test('parse page et limit', () => {
    const p = parsePaginationParams({ page: '3', limit: '50' });
    expect(p.page).toBe(3);
    expect(p.limit).toBe(50);
  });

  test('plafond limit à 100', () => {
    const p = parsePaginationParams({ limit: '500' });
    expect(p.limit).toBe(100);
  });

  test('page minimum = 1', () => {
    const p = parsePaginationParams({ page: '-5' });
    expect(p.page).toBe(1);
  });
});

describe('buildPaginationMeta', () => {
  test('construit les métadonnées correctement', () => {
    const meta = buildPaginationMeta(150, { page: 2, limit: 20 });
    expect(meta.total).toBe(150);
    expect(meta.totalPages).toBe(8);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(true);
  });

  test('première page : hasPrev = false', () => {
    const meta = buildPaginationMeta(50, { page: 1, limit: 20 });
    expect(meta.hasPrev).toBe(false);
    expect(meta.hasNext).toBe(true);
  });

  test('dernière page : hasNext = false', () => {
    const meta = buildPaginationMeta(40, { page: 2, limit: 20 });
    expect(meta.hasNext).toBe(false);
  });
});

describe('cursor encoding', () => {
  test('encode et décode correctement', () => {
    const encoded = encodeCursor(42);
    const decoded = decodeCursor(encoded);
    expect(decoded).toBe(42);
  });

  test('décode retourne null pour une valeur invalide', () => {
    expect(decodeCursor('!!!invalid!!!')).toBeNull();
  });
});

describe('buildNextCursor', () => {
  test('retourne null pour une liste vide', () => {
    expect(buildNextCursor([])).toBeNull();
  });

  test('encode le dernier id', () => {
    const items = [{ id: 10 }, { id: 20 }, { id: 30 }];
    const cursor = buildNextCursor(items);
    expect(decodeCursor(cursor)).toBe(30);
  });
});

describe('applyPagination', () => {
  test('offset-based sans cursor', () => {
    const q = applyPagination({ page: 3, limit: 10, cursor: null });
    expect(q.take).toBe(10);
    expect(q.skip).toBe(20);
  });

  test('cursor-based avec cursor', () => {
    const cursor = encodeCursor(50);
    const decoded = decodeCursor(cursor);
    const q = applyPagination({ page: 1, limit: 10, cursor: decoded });
    expect(q.take).toBe(10);
    expect(q.skip).toBe(1);
    expect(q.cursor).toEqual({ id: 50 });
  });
});
