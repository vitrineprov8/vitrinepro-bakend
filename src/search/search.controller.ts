import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';

/**
 * Public search endpoints — no authentication required.
 *
 * GET /search               → paginated portfolio search with scoring & filters
 * GET /search/autocomplete  → typeahead suggestions (max 8 results)
 */
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() dto: SearchQueryDto) {
    return this.searchService.search(dto);
  }

  @Get('autocomplete')
  autocomplete(@Query() dto: AutocompleteQueryDto) {
    return this.searchService.autocomplete(dto);
  }
}
