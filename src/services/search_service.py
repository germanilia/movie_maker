from typing import List, Dict
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.content_filter_strategy import PruningContentFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from duckduckgo_search import DDGS

class SearchService:
    def __init__(self):
        self.search_engine = "duckduckgo"
        self.browser_config = BrowserConfig(
            headless=True,
            verbose=True
        )
        self.ddgs = DDGS(timeout=20)
        
    async def search(self, query: str) -> List[Dict[str, str]]:
        """
        Search for content using DuckDuckGo
        Combines text and news results for comprehensive coverage
        """
        try:
            # Get text search results
            text_results = list(self.ddgs.text(
                keywords=query,
                region="wt-wt",
                safesearch="off",
                timelimit="m",  # Last month
                max_results=5
            ))
            
            # Get news results
            news_results = list(self.ddgs.news(
                keywords=query,
                region="wt-wt",
                safesearch="off",
                timelimit="m",  # Last month
                max_results=5
            ))
            
            # Combine and format results
            combined_results = []
            
            # Add text results
            for result in text_results:
                combined_results.append({
                    "url": result["href"],
                    "title": result["title"],
                    "snippet": result["body"]
                })
                
            # Add news results
            for result in news_results:
                combined_results.append({
                    "url": result["url"],
                    "title": result["title"],
                    "snippet": result["body"]
                })
                
            return combined_results[:5]  # Return top 5 combined results
            
        except Exception as e:
            print(f"Search error: {str(e)}")
            return []

    async def scrape_content(self, url: str) -> str:
        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.ENABLED,
            markdown_generator=DefaultMarkdownGenerator(
                content_filter=PruningContentFilter(threshold=0.48, min_word_threshold=0)
            )
        )
        
        async with AsyncWebCrawler(config=self.browser_config) as crawler:
            result = await crawler.arun(
                url=url,
                config=run_config
            )
            return result.fit_markdown or result.markdown_v2.fit_markdown or ""  # type: ignore