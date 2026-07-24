import asyncio
import logging
import sys
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import database session and service
from src.services.rag_enricher import RAGEnricherService

# Configure logging for separate console view
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("rag_worker")

async def main():
    logger.info("Initializing standalone RAG Background Enricher Worker...")
    
    # Start the worker loop
    await RAGEnricherService.start()
    
    # Stand-alone worker loop keeps running
    try:
        while True:
            await asyncio.sleep(1.0)
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Termination signal received. Shutting down worker...")
        await RAGEnricherService.stop()
        logger.info("Worker stopped cleanly.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user.")
