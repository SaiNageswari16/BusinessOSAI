import os
import logging

logger = logging.getLogger(__name__)

def _get_pause_file_path() -> str:
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(backend_dir, ".ai_image_search_paused")

def is_ai_image_search_paused() -> bool:
    """
    Returns True if external AI image scraping/searching is globally paused by Admin.
    When paused:
    - Products get clean default/uploaded images with 0 external image scraping calls.
    - Text metadata (names, short & long descriptions, specifications, brand, category, HSN, price)
      CONTINUES to be enriched normally via AI!
    """
    try:
        pause_file = _get_pause_file_path()
        return os.path.exists(pause_file)
    except Exception as e:
        logger.warning(f"Error checking AI image pause state: {e}")
        return False

def set_ai_image_search_paused(paused: bool) -> bool:
    """
    Pause or resume external AI image scraping globally across all workspaces.
    Does NOT affect text metadata (descriptions, specifications, categories) enrichment.
    """
    pause_file = _get_pause_file_path()
    rag_pause_file = os.path.join(os.path.dirname(pause_file), ".rag_enricher_paused")
    
    try:
        # Always remove legacy .rag_enricher_paused so text enrichment continues
        if os.path.exists(rag_pause_file):
            try:
                os.remove(rag_pause_file)
            except Exception:
                pass

        if paused:
            with open(pause_file, "w") as f:
                f.write("paused")
            logger.info("⏸️ [AI IMAGE SEARCH] AI image scraping PAUSED globally by Admin. (Text & description gathering remains ACTIVE)")
            return True
        else:
            if os.path.exists(pause_file):
                try:
                    os.remove(pause_file)
                except Exception:
                    pass
            logger.info("▶️ [AI IMAGE SEARCH] AI image scraping RESUMED globally by Admin.")
            return False
    except Exception as e:
        logger.error(f"Failed to update AI image search pause state: {e}")
        return is_ai_image_search_paused()
