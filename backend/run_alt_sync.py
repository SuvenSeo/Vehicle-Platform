import asyncio
import os

import run_sync as unified_sync

# Backward-compatible exports used by runtime guard tests.
_run_source = unified_sync._run_source
_resolve_enabled_sources = unified_sync._resolve_enabled_sources


async def main():
    previous_profile = os.getenv("SCRAPE_PROFILE")
    os.environ["SCRAPE_PROFILE"] = "alt"
    try:
        await unified_sync.main(profile_override="alt")
    finally:
        if previous_profile is None:
            os.environ.pop("SCRAPE_PROFILE", None)
        else:
            os.environ["SCRAPE_PROFILE"] = previous_profile


if __name__ == "__main__":
    asyncio.run(main())
