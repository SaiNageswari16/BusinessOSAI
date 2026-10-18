"""Model hub — mirrors the BusinessOSAI pattern.

Every model module is star-imported here so `from src.models import X` works
everywhere. SQLAlchemy resolves string-based relationship targets against this
namespace, so a new model file MUST be added to the imports below.
"""

from .core import *  # noqa: F401,F403
from .menu import *  # noqa: F401,F403
from .orders import *  # noqa: F401,F403
from .kitchen import *  # noqa: F401,F403
from .billing import *  # noqa: F401,F403
from .shift import *  # noqa: F401,F403
from .inventory import *  # noqa: F401,F403
from .purchase import *  # noqa: F401,F403
from .staff import *  # noqa: F401,F403
from .loyalty import *  # noqa: F401,F403
