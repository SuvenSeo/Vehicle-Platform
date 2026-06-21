"""Upload generated AutoLens snapshots to Cloudflare R2.

Required environment variables:
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET

Optional:
  R2_PREFIX, defaults to "latest"
"""

from __future__ import annotations

import mimetypes
import os
from pathlib import Path


def required_env(name: str) -> str | None:
    value = os.getenv(name, "").strip()
    return value or None


def content_type_for(path: Path) -> str:
    if path.suffix == ".json":
        return "application/json; charset=utf-8"
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def iter_files(source: Path):
    for path in source.rglob("*"):
        if path.is_file():
            yield path


def main() -> None:
    source = Path(os.getenv("SNAPSHOT_SOURCE_DIR", "snapshots/latest")).resolve()
    prefix = (os.getenv("R2_PREFIX") or "latest").strip().strip("/")
    account_id = required_env("R2_ACCOUNT_ID")
    access_key = required_env("R2_ACCESS_KEY_ID")
    secret_key = required_env("R2_SECRET_ACCESS_KEY")
    bucket = required_env("R2_BUCKET")

    missing = [
        name
        for name, value in {
            "R2_ACCOUNT_ID": account_id,
            "R2_ACCESS_KEY_ID": access_key,
            "R2_SECRET_ACCESS_KEY": secret_key,
            "R2_BUCKET": bucket,
        }.items()
        if not value
    ]
    if missing:
        print(f"Skipping R2 upload; missing env: {', '.join(missing)}")
        return
    if not source.exists():
        raise FileNotFoundError(f"Snapshot source directory does not exist: {source}")

    try:
        import boto3
    except ImportError as exc:
        raise SystemExit("boto3 is required for R2 uploads. Install with: pip install boto3") from exc

    endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
    client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )

    uploaded = 0
    for path in iter_files(source):
        rel = path.relative_to(source).as_posix()
        key = f"{prefix}/{rel}" if prefix else rel
        extra_args = {
            "ContentType": content_type_for(path),
            "CacheControl": "public, max-age=300, stale-while-revalidate=86400",
        }
        client.upload_file(str(path), bucket, key, ExtraArgs=extra_args)
        uploaded += 1
        print(f"uploaded s3://{bucket}/{key}")

    print(f"Uploaded {uploaded} snapshot files to R2 bucket {bucket}.")


if __name__ == "__main__":
    main()
