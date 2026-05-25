import { Controller, Get, Query } from '@nestjs/common';
import { SeoService, TombstoneLookupResult } from './seo.service';
import { LookupTombstoneDto } from './dto/lookup-tombstone.dto';

/**
 * Public SEO endpoint — no authentication required.
 *
 * Used by the frontend (SSR/ISR pages) to decide whether a 404 URL should be
 * served as:
 *   - HTTP 410 Gone  → tombstone exists, reason = 'deleted' | 'hidden'
 *   - HTTP 301       → tombstone exists, reason = 'renamed', redirectTo set
 *   - HTTP 404       → tombstone absent (URL never existed or already expired)
 */
@Controller('seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  /**
   * GET /seo/tombstone?type=portfolio&slug=meu-projeto
   *
   * Returns:
   *   { exists: false }
   *   { exists: true, reason: 'deleted' }
   *   { exists: true, reason: 'hidden' }
   *   { exists: true, reason: 'renamed', redirectTo: '/portfolio/novo-slug' }
   */
  @Get('tombstone')
  lookup(@Query() dto: LookupTombstoneDto): Promise<TombstoneLookupResult> {
    return this.seoService.lookupTombstone(dto.type, dto.slug);
  }
}
