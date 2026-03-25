import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PortfolioItem } from '../portfolio/portfolio.entity';
import { SearchQueryDto } from './dto/search-query.dto';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';

@Injectable()
export class SearchService implements OnModuleInit {
  constructor(
    @InjectRepository(PortfolioItem)
    private readonly portfolioRepository: Repository<PortfolioItem>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Ensures the pg_trgm extension is available before any search query runs.
   * Required because the project uses synchronize:true (no migration runner),
   * so the extension cannot be guaranteed by a migration at startup.
   */
  async onModuleInit() {
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  }

  /**
   * Full search with fuzzy scoring, filters, sorting and pagination.
   *
   * Routing by type:
   *  - professional / specialty → searchUsers()  → returns profile cards (1 per user)
   *  - project                  → searchPortfolio() → returns portfolio item cards
   *  - all                      → searchAll()    → merges both result sets
   *
   * Each item in `data` carries a `kind` discriminator:
   *  - 'profile'   (professional / specialty results)
   *  - 'portfolio' (project results)
   */
  async search(dto: SearchQueryDto) {
    const page = Math.max(dto.page ?? 1, 1);
    const limit = Math.min(dto.limit ?? 12, 50);
    const q = dto.q?.trim() || '';
    const type = dto.type || 'all';

    if (type === 'professional' || type === 'specialty') {
      return this.searchUsers(q, type, dto, page, limit);
    }
    if (type === 'project') {
      return this.searchPortfolio(q, dto, page, limit);
    }
    // type === 'all'
    return this.searchAll(q, dto, page, limit);
  }

  // ─── Búsqueda de usuarios (professional / specialty) ─────────────────────
  //
  // Uses exclusively positional parameters ($1, $2, ...) so that every raw
  // query passed to this.dataSource.query() is unambiguous.
  //
  // Parameter binding order (when q is non-empty):
  //   $1 = qLike  ('%query%')
  //   $2 = q      (raw term, used by similarity())
  //   $3 = cityLike ('%city%')  — only present when dto.city is set
  //   Last two positional params are always $N-1 = limit, $N = offset
  //
  // When q is empty (browse mode):
  //   $1 = cityLike — only when dto.city is set
  //   Last two are limit / offset

  private async searchUsers(
    q: string,
    type: string,
    dto: SearchQueryDto,
    page: number,
    limit: number,
  ) {
    const hasQ = q.length > 0;
    const qLike = hasQ ? `%${q.toLowerCase()}%` : null;
    const hasCity = Boolean(dto.city);
    const cityLike = hasCity ? `%${dto.city!.toLowerCase()}%` : null;

    // ── Build positional parameter array ──────────────────────────────────
    // We always know the slot of each value so that score expressions and
    // WHERE clauses can reference them by fixed index.
    //
    // With query:    [$1=qLike, $2=q, ($3=cityLike)?]  then limit/offset
    // Without query: [($1=cityLike)?]                  then limit/offset

    const params: unknown[] = [];

    let pqLike = 0; // positional index for qLike  (1-based)
    let pq = 0;     // positional index for q exact (1-based)
    let pCity = 0;  // positional index for cityLike (1-based)

    if (hasQ) {
      params.push(qLike); // $1
      pqLike = 1;
      params.push(q);     // $2
      pq = 2;
    }

    if (hasCity) {
      params.push(cityLike);
      pCity = params.length; // $2 (no-q) or $3 (with-q)
    }

    // limit / offset come last
    params.push(limit);
    const pLimit = params.length;
    params.push((page - 1) * limit);
    const pOffset = params.length;

    // ── Score SQL fragment ────────────────────────────────────────────────
    // Built only when hasQ; references $pqLike and $pq by index.

    const nameScoreSQL = hasQ
      ? `GREATEST(
           CASE
             WHEN LOWER(u."firstName" || ' ' || u."lastName") = LOWER($${pq})  THEN 100
             WHEN LOWER(u."firstName" || ' ' || u."lastName") LIKE $${pqLike}  THEN 80
             WHEN LOWER(u."firstName" || ' ' || u."lastName") LIKE $${pqLike}  THEN 40
             ELSE FLOOR(similarity(u."firstName" || ' ' || u."lastName", $${pq}) * 30)
           END, 0)`
      : '0';

    const professionScoreSQL = hasQ
      ? `GREATEST(
           CASE
             WHEN LOWER(COALESCE(u.profession,'')) = LOWER($${pq})  THEN 100
             WHEN LOWER(COALESCE(u.profession,'')) LIKE $${pqLike}  THEN 80
             WHEN LOWER(COALESCE(u.profession,'')) LIKE $${pqLike}  THEN 40
             ELSE FLOOR(similarity(COALESCE(u.profession,''), $${pq}) * 30)
           END, 0)`
      : '0';

    const scoreSQL =
      type === 'specialty'
        ? professionScoreSQL
        : hasQ
          ? `GREATEST(${nameScoreSQL}, ${professionScoreSQL}, 0)`
          : '0';

    // ── WHERE clauses (mainSQL uses pqLike from `params`) ────────────────

    const nameWhere = hasQ
      ? `(LOWER(u."firstName" || ' ' || u."lastName") LIKE $${pqLike}
         OR LOWER(COALESCE(u.username,'')) LIKE $${pqLike})`
      : 'TRUE';

    const specialtyWhere = hasQ
      ? `LOWER(COALESCE(u.profession,'')) LIKE $${pqLike}`
      : 'TRUE';

    const searchWhere =
      type === 'specialty' ? specialtyWhere : nameWhere;

    const cityWhere = hasCity
      ? `AND LOWER(COALESCE(u.location,'')) LIKE $${pCity}`
      : '';

    // ── Existence guard: only show users with at least one published item ──
    const existsGuard = `EXISTS (
      SELECT 1 FROM portfolio_items p2
      WHERE p2."userId" = u.id AND p2.status = 'PUBLISHED'
    )`;

    // ── Count / cities params ─────────────────────────────────────────────
    // count and cities queries only need qLike and cityLike (no similarity).
    // Build a dedicated params array so $N indices stay correct.
    const cntParams: unknown[] = [];
    let cqLike = 0;
    let cCity = 0;
    if (hasQ)   { cntParams.push(qLike);     cqLike = cntParams.length; }
    if (hasCity){ cntParams.push(cityLike);   cCity  = cntParams.length; }

    const cntNameWhere = hasQ
      ? `(LOWER(u."firstName" || ' ' || u."lastName") LIKE $${cqLike}
         OR LOWER(COALESCE(u.username,'')) LIKE $${cqLike})`
      : 'TRUE';
    const cntSpecialtyWhere = hasQ
      ? `LOWER(COALESCE(u.profession,'')) LIKE $${cqLike}`
      : 'TRUE';
    const cntSearchWhere = type === 'specialty' ? cntSpecialtyWhere : cntNameWhere;
    const cntCityWhere   = hasCity ? `AND LOWER(COALESCE(u.location,'')) LIKE $${cCity}` : '';

    const countSQL = `
      SELECT COUNT(DISTINCT u.id) AS count
      FROM users u
      WHERE ${existsGuard}
        AND ${cntSearchWhere}
        ${cntCityWhere}
    `;

    const countResult = await this.dataSource.query<[{ count: string }]>(
      countSQL,
      cntParams,
    );

    // ── Main SELECT ───────────────────────────────────────────────────────
    const mainSQL = `
      SELECT
        u.id,
        u."firstName",
        u."lastName",
        u.username,
        u.profession,
        u.location,
        u."avatarUrl",
        u."bannerColor",
        u.bio,
        u.phone,
        u.website,
        u."socialLinks",
        COUNT(DISTINCT p.id)::int AS "projectCount",
        ${scoreSQL} AS score
      FROM users u
      LEFT JOIN portfolio_items p
        ON p."userId" = u.id AND p.status = 'PUBLISHED'
      WHERE ${existsGuard}
        AND ${searchWhere}
        ${cityWhere}
      GROUP BY u.id
      ORDER BY score DESC, u."firstName" ASC
      LIMIT $${pLimit} OFFSET $${pOffset}
    `;

    const rows = await this.dataSource.query<
      Array<{
        id: string;
        firstName: string;
        lastName: string;
        username: string | null;
        profession: string | null;
        location: string | null;
        avatarUrl: string | null;
        bannerColor: string | null;
        bio: string | null;
        phone: string | null;
        website: string | null;
        socialLinks: Record<string, string> | null;
        projectCount: number;
        score: number;
      }>
    >(mainSQL, params);

    // ── Cities metadata ───────────────────────────────────────────────────
    const citiesSQL = `
      SELECT DISTINCT u.location
      FROM users u
      WHERE u.location IS NOT NULL
        AND ${existsGuard}
        AND ${cntSearchWhere}
        ${cntCityWhere}
    `;

    const citiesRaw = await this.dataSource.query<Array<{ location: string }>>(
      citiesSQL,
      cntParams,
    );
    const cities = citiesRaw
      .map((r) => r.location)
      .filter(Boolean)
      .sort() as string[];

    const total = parseInt(countResult[0]?.count ?? '0', 10);

    return {
      data: rows.map((r) => ({
        kind: 'profile' as const,
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        username: r.username,
        profession: r.profession,
        location: r.location,
        avatarUrl: r.avatarUrl,
        bannerColor: r.bannerColor,
        bio: r.bio,
        phone: r.phone,
        website: r.website,
        socialLinks: r.socialLinks,
        projectCount: r.projectCount,
      })),
      total,
      page,
      lastPage: Math.ceil(total / limit) || 1,
      cities,
      availableTags: [],
    };
  }

  // ─── Búsqueda de portfolio items (project) ────────────────────────────────

  private async searchPortfolio(
    q: string,
    dto: SearchQueryDto,
    page: number,
    limit: number,
  ) {
    const qb = this.portfolioRepository
      .createQueryBuilder('p')
      .innerJoin('p.user', 'u')
      // Select only the columns we need from the user row
      .addSelect([
        'u.id',
        'u.firstName',
        'u.lastName',
        'u.username',
        'u.avatarUrl',
        'u.profession',
        'u.location',
      ])
      .leftJoinAndSelect('p.tags', 'tag')
      .where('p.status = :status', { status: 'PUBLISHED' });

    if (q) {
      // Score expressions — use TypeORM named parameters here because
      // QueryBuilder manages its own parameter binding internally.
      const titleScore = `GREATEST(
        CASE
          WHEN LOWER(p.title) = LOWER(:q)  THEN 100
          WHEN LOWER(p.title) LIKE :qStart THEN 80
          WHEN LOWER(p.title) LIKE :qLike  THEN 40
          ELSE FLOOR(similarity(p.title, :q) * 30)
        END, 0)`;

      const tagScore = `COALESCE((
        SELECT MAX(
          CASE
            WHEN LOWER(t2.name) = LOWER(:q)  THEN 100
            WHEN LOWER(t2.name) LIKE :qStart THEN 80
            WHEN LOWER(t2.name) LIKE :qLike  THEN 50
            ELSE FLOOR(similarity(t2.name, :q) * 35)
          END)
        FROM portfolio_tags pt2
        JOIN tags t2 ON t2.id = pt2."tagsId"
        WHERE pt2."portfolioItemsId" = p.id
      ), 0)`;

      qb.addSelect(`GREATEST(${titleScore}, ${tagScore}, 0)`, 'score');
      qb.setParameter('q', q);
      qb.setParameter('qLike', `%${q.toLowerCase()}%`);
      qb.setParameter('qStart', `${q.toLowerCase()}%`);

      qb.andWhere(`(
        LOWER(p.title) LIKE :qLike
        OR EXISTS (
          SELECT 1 FROM portfolio_tags pt3
          JOIN tags t3 ON t3.id = pt3."tagsId"
          WHERE pt3."portfolioItemsId" = p.id AND LOWER(t3.name) LIKE :qLike
        )
      )`);
    }

    // Optional filters
    if (dto.city) {
      qb.andWhere("LOWER(COALESCE(u.location,'')) LIKE :city", {
        city: `%${dto.city.toLowerCase()}%`,
      });
    }
    if (dto.hasImage === true) {
      qb.andWhere('p."coverImageUrl" IS NOT NULL');
    } else if (dto.hasImage === false) {
      qb.andWhere('p."coverImageUrl" IS NULL');
    }
    if (dto.projectStatus) {
      qb.andWhere('p."projectStatus" = :projectStatus', {
        projectStatus: dto.projectStatus,
      });
    }
    if (dto.dateFrom) {
      qb.andWhere('p."createdAt" >= :dateFrom', {
        dateFrom: new Date(dto.dateFrom),
      });
    }
    if (dto.dateTo) {
      qb.andWhere('p."createdAt" <= :dateTo', {
        dateTo: new Date(dto.dateTo),
      });
    }
    if (dto.tagId) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM portfolio_tags ptf
          WHERE ptf."portfolioItemsId" = p.id AND ptf."tagsId" = :tagId
        )`,
        { tagId: dto.tagId },
      );
    }

    // Sorting
    if (dto.sortBy === 'date') {
      qb.orderBy('p.createdAt', (dto.sortOrder as 'ASC' | 'DESC') || 'DESC');
    } else if (dto.sortBy === 'year') {
      qb.orderBy('p.year', (dto.sortOrder as 'ASC' | 'DESC') || 'DESC');
    } else {
      qb.orderBy(q ? 'score' : 'p.createdAt', 'DESC');
    }

    // Metadata pass: collect cities + available tag ids without pagination
    const metaQb = qb.clone().select(['p.id', 'u.location']);
    metaQb.expressionMap.orderBys = {};
    const allRaw = await metaQb.getRawMany<{
      p_id: string;
      u_location: string | null;
    }>();

    const cities = [
      ...new Set(allRaw.map((r) => r.u_location).filter(Boolean)),
    ].sort() as string[];

    let availableTags: Array<{ id: string; name: string }> = [];
    if (allRaw.length > 0) {
      const itemIds = allRaw.map((r) => r.p_id);
      availableTags = await this.dataSource.query<
        Array<{ id: string; name: string }>
      >(
        `SELECT DISTINCT t.id, t.name
           FROM tags t
           INNER JOIN portfolio_tags pt ON pt."tagsId" = t.id
          WHERE pt."portfolioItemsId" = ANY($1)
          ORDER BY t.name`,
        [itemIds],
      );
    }

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: items.map((item) => ({
        kind: 'portfolio' as const,
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        slug: item.slug,
        coverImageUrl: item.coverImageUrl,
        clientName: item.clientName,
        year: item.year,
        projectStatus: item.projectStatus,
        status: item.status,
        tags: item.tags ?? [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        user: item.user
          ? {
              id: item.user.id,
              firstName: item.user.firstName,
              lastName: item.user.lastName,
              username: item.user.username,
              avatarUrl: item.user.avatarUrl,
              profession: item.user.profession,
              location: item.user.location,
            }
          : null,
      })),
      total,
      page,
      lastPage: Math.ceil(total / limit) || 1,
      cities,
      availableTags,
    };
  }

  // ─── Búsqueda general (all) ───────────────────────────────────────────────
  //
  // Fetches up to 200 profiles and 200 portfolio items, then interleaves them
  // in position order (both sub-lists are already score-sorted) and paginates
  // in memory. This keeps the merged result set relevant without a complex
  // cross-table UNION score query.

  private async searchAll(
    q: string,
    dto: SearchQueryDto,
    page: number,
    limit: number,
  ) {
    const [profilesResult, portfolioResult] = await Promise.all([
      this.searchUsers(q, 'professional', dto, 1, 200),
      this.searchPortfolio(q, dto, 1, 200),
    ]);

    // Interleave: for relevance-sorted results we alternate profile / portfolio
    // so neither type dominates the first page. Each sub-list is already in
    // score-DESC order, so pairing them preserves relative ranking.
    const merged: Array<
      (typeof profilesResult.data)[number] | (typeof portfolioResult.data)[number]
    > = [];

    const maxLen = Math.max(
      profilesResult.data.length,
      portfolioResult.data.length,
    );
    for (let i = 0; i < maxLen; i++) {
      if (i < profilesResult.data.length) merged.push(profilesResult.data[i]);
      if (i < portfolioResult.data.length) merged.push(portfolioResult.data[i]);
    }

    const total = merged.length;
    const offset = (page - 1) * limit;
    const data = merged.slice(offset, offset + limit);

    const cities = [
      ...new Set([...profilesResult.cities, ...portfolioResult.cities]),
    ].sort();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit) || 1,
      cities,
      availableTags: portfolioResult.availableTags,
    };
  }

  /**
   * Typeahead suggestions for the search bar.
   *
   * Returns up to 8 deduplicated suggestions combining:
   *  - Professional names (users with published items)
   *  - Specialty / profession labels
   *  - Tag names
   *  - Portfolio item titles
   *
   * Each suggestion has the shape { label, value, type }.
   */
  async autocomplete(dto: AutocompleteQueryDto) {
    const type = dto.type || 'all';
    const q = dto.q;
    const qLike = `%${q.toLowerCase()}%`;

    const suggestions: Array<{ label: string; value: string; type: string }> =
      [];

    if (type === 'professional' || type === 'all') {
      const professionals = await this.dataSource.query<
        Array<{ label: string; value: string; type: string }>
      >(
        `SELECT
           u."firstName" || ' ' || u."lastName" AS label,
           u.username                            AS value,
           'professional'                        AS type
         FROM users u
         INNER JOIN portfolio_items p
           ON p."userId" = u.id AND p.status = 'PUBLISHED'
         WHERE LOWER(u."firstName" || ' ' || u."lastName") LIKE $1
            OR (u."firstName" != '' AND similarity(u."firstName" || ' ' || u."lastName", $2) > 0.15)
         GROUP BY u.id
         ORDER BY similarity(u."firstName" || ' ' || u."lastName", $2) DESC
         LIMIT 5`,
        [qLike, q],
      );
      suggestions.push(...professionals);
    }

    if (type === 'specialty' || type === 'all') {
      const specialties = await this.dataSource.query<
        Array<{ label: string; value: string; type: string }>
      >(
        `SELECT
           u.profession AS label,
           u.profession AS value,
           'specialty'  AS type
         FROM users u
         INNER JOIN portfolio_items p
           ON p."userId" = u.id AND p.status = 'PUBLISHED'
         WHERE u.profession IS NOT NULL
           AND u.profession != ''
           AND LOWER(u.profession) LIKE $1
         GROUP BY u.profession
         ORDER BY similarity(u.profession, $2) DESC
         LIMIT 4`,
        [qLike, q],
      );
      suggestions.push(...specialties);
    }

    if (type === 'project' || type === 'all') {
      const tags = await this.dataSource.query<
        Array<{ label: string; value: string; type: string }>
      >(
        `SELECT
           t.name AS label,
           t.slug AS value,
           'tag'  AS type
         FROM tags t
         INNER JOIN portfolio_tags pt ON pt."tagsId" = t.id
         INNER JOIN portfolio_items p
           ON p.id = pt."portfolioItemsId" AND p.status = 'PUBLISHED'
         WHERE LOWER(t.name) LIKE $1
         GROUP BY t.id
         ORDER BY similarity(t.name, $2) DESC
         LIMIT 4`,
        [qLike, q],
      );

      const titles = await this.dataSource.query<
        Array<{ label: string; value: string; type: string }>
      >(
        `SELECT title AS label,
                slug  AS value,
                'project' AS type
         FROM portfolio_items
         WHERE status = 'PUBLISHED'
           AND LOWER(title) LIKE $1
         ORDER BY similarity(title, $2) DESC
         LIMIT 3`,
        [qLike, q],
      );

      suggestions.push(...tags, ...titles);
    }

    // Deduplicate by label and cap at 8 results
    const seen = new Set<string>();
    const result = suggestions
      .filter((s) => {
        if (!s.label || seen.has(s.label)) return false;
        seen.add(s.label);
        return true;
      })
      .slice(0, 8);

    return result;
  }
}
