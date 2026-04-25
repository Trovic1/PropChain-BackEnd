import { Controller, Get, Post, Query, Body, UseGuards, Request } from '@nestjs/common';
import { SearchService, SearchQuery } from './search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('properties')
  @ApiOperation({ summary: 'Search properties with advanced filters' })
  @ApiResponse({ status: 200, description: 'Search results returned successfully' })
  async searchProperties(@Request() req, @Body() searchQuery: SearchQuery) {
    return this.searchService.searchProperties(req.user.id, searchQuery);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get search autocomplete suggestions' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  @ApiResponse({ status: 200, description: 'Suggestions returned successfully' })
  async getSuggestions(@Query('q') query?: string) {
    return this.searchService.getSuggestions(query || '');
  }

  @Get('filters/saved')
  @ApiOperation({ summary: 'Get user\'s saved filters' })
  @ApiResponse({ status: 200, description: 'Saved filters returned successfully' })
  async getSavedFilters(@Request() req) {
    return this.searchService.getSavedFilters(req.user.id);
  }

  @Post('filters/save')
  @ApiOperation({ summary: 'Save a search filter' })
  @ApiResponse({ status: 201, description: 'Filter saved successfully' })
  async saveFilter(@Request() req, @Body() filter: any) {
    return this.searchService.saveFilter(req.user.id, filter);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get search analytics' })
  @ApiResponse({ status: 200, description: 'Analytics returned successfully' })
  async getSearchAnalytics(@Request() req) {
    return this.searchService.getSearchAnalytics(req.user.id);
  }

  @Get('analytics/popular')
  @ApiOperation({ summary: 'Get popular searches' })
  @ApiResponse({ status: 200, description: 'Popular searches returned successfully' })
  async getPopularSearches() {
    return this.searchService.getPopularSearches();
  }
}
