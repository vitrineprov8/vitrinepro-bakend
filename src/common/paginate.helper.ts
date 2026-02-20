import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  lastPage: number;
}

export async function paginate<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  page: number = 1,
  limit: number = 10,
): Promise<PaginatedResult<T>> {
  const safeLimit = Math.min(limit, 20);
  const safePage = Math.max(page, 1);
  const skip = (safePage - 1) * safeLimit;

  const [data, total] = await queryBuilder
    .skip(skip)
    .take(safeLimit)
    .getManyAndCount();

  return {
    data,
    total,
    page: safePage,
    lastPage: Math.ceil(total / safeLimit),
  };
}
