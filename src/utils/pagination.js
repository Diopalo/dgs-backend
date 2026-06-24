'use strict';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

function parsePaginationParams(query) {
  const page   = Math.max(1, parseInt(query.page,  10) || 1);
  const limit  = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  return { page, limit, cursor };
}

function buildPaginationMeta(total, params) {
  const { page, limit } = params;
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext:  page < totalPages,
    hasPrev:  page > 1,
  };
}

function applyPagination(params) {
  const { page, limit, cursor } = params;

  if (cursor) {
    return {
      take: limit,
      skip: 1,
      cursor: { id: cursor },
    };
  }

  return {
    take: limit,
    skip: (page - 1) * limit,
  };
}

function encodeCursor(id) {
  return Buffer.from(JSON.stringify({ id })).toString('base64');
}

function decodeCursor(cursor) {
  try {
    const { id } = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    return Number(id);
  } catch {
    return null;
  }
}

function buildNextCursor(items) {
  if (!items.length) return null;
  return encodeCursor(items[items.length - 1].id);
}

module.exports = { parsePaginationParams, buildPaginationMeta, applyPagination, encodeCursor, decodeCursor, buildNextCursor };
