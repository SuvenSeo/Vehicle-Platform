import logging
from apscheduler.schedulers.blocking import BlockingScheduler
from db.session import HotSessionLocal as SessionLocal
from app.scrapers.ikman import IkmanCarScraper
from app.scrapers.riyasewana import RiyasewanaScraper
from app.services.aggregator import CarPriceAggregator
import asyncio
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scheduler")

async def sync_job():
    logger.info(f"Starting scheduled sync at {datetime.now()}")
    db = SessionLocal()
    try:
        # Run scrapers
        ikman = IkmanCarScraper(db)
        await ikman.scrape(max_pages=20)
        
        riyasewana = RiyasewanaScraper(db)
        await riyasewana.scrape(max_pages=20)
        
        # Run intelligence
        aggregator = CarPriceAggregator(db)
        now = datetime.now()
        aggregator.compute_aggregates(now.year, now.month)
        aggregator.update_deal_scores()
        
        logger.info("Schedule sync completed successfully.")
    except Exception as e:
        logger.error(f"Scheduled sync failed: {e}")
    finally:
        db.close()

def run_sync_wrapper():
    asyncio.run(sync_job())

if __name__ == "__main__":
    scheduler = BlockingScheduler()
    # Schedule to run every night at 3:00 AM
    scheduler.add_job(run_sync_wrapper, 'cron', hour=3, minute=0)
    
    logger.info("Scheduler started. Nightly sync set for 03:00 AM.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        pass
