import os
import logging

logger = logging.getLogger(__name__)

def _get_pause_file_path() -> str:
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(backend_dir, ".ai_image_search_paused")

def is_ai_image_search_paused() -> bool:
    """
    Returns True if external AI image scraping/searching is globally paused by Admin.
    When paused, products use default placeholder or user-uploaded images, with 0 web image calls.
    """
    try:
        pause_file = _get_pause_file_path()
        return os.path.exists(pause_file)
    except Exception as e:
        logger.warning(f"Error checking AI image pause state: {e}")
        return False

def set_ai_image_search_paused(paused: bool) -> bool:
    """
    Pause or resume external AI image scraping/searching globally across all workspaces.
    """
    pause_file = _get_pause_file_path()
    rag_pause_file = os.path.join(os.path.dirname(pause_file), ".rag_enricher_paused")
    
    try:
        if paused:
            with open(pause_file, "w") as f:
                f.write("paused")
            with open(rag_pause_file, "w") as f:
                f.write("paused")
            logger.info("⏸️ [AI IMAGE SEARCH] AI image search & RAG enrichment PAUSED globally by Admin.")
            return True
        else:
            if os.path.exists(pause_file):
                try:
                    os.remove(pause_file)
                except Exception:
                    pass
            if os.path.exists(rag_pause_file):
                try:
                    os.remove(rag_pause_file)
                except Exception:
                    pass
            logger.info("▶️ [AI IMAGE SEARCH] AI image search & RAG enrichment RESUMED globally by Admin.")
            return False
    except Exception as e:
        logger.error(f"Failed to update AI image search pause state: {e}")
        return is_ai_image_search_paused()
