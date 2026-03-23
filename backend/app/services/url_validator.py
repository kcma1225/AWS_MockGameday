import ipaddress
import socket
import re
from urllib.parse import urlparse


BLOCKED_HOSTS = {
    "localhost",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
    "169.254.169.254",  # AWS metadata
    "fd00:ec2::254",    # AWS metadata IPv6
}

BLOCKED_METADATA_PATHS = [
    "/latest/meta-data",
    "/computeMetadata",
]


def _is_private_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_unspecified
            or ip.is_multicast
        )
    except ValueError:
        return True  # Fail safe


def validate_submission_url(
    url: str,
    enforce_root_only: bool = False,
) -> tuple[bool, str, str | None]:
    """
    Validate a submitted URL for safety and correctness.

    Returns:
        (is_valid, error_message_or_empty, normalized_url_or_none)
    """
    if not url or not url.strip():
        return False, "URL cannot be empty", None

    url = url.strip()

    # Protocol check
    if not re.match(r"^https?://", url, re.IGNORECASE):
        return False, "URL must use http:// or https:// protocol", None

    # Length check
    if len(url) > 2000:
        return False, "URL is too long (max 2000 characters)", None

    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Malformed URL", None

    if not parsed.scheme or not parsed.netloc:
        return False, "Invalid URL structure", None

    if parsed.scheme.lower() not in ("http", "https"):
        return False, "Only http and https protocols are allowed", None

    hostname = parsed.hostname
    if not hostname:
        return False, "No hostname in URL", None

    # Block known dangerous hostnames
    if hostname.lower() in BLOCKED_HOSTS:
        return False, "This hostname is not allowed", None

    # Block metadata paths regardless of host
    path = parsed.path or ""
    for blocked_path in BLOCKED_METADATA_PATHS:
        if path.startswith(blocked_path):
            return False, "This URL path is not allowed", None

    if enforce_root_only:
        # Root-only means scheme + host (+ optional port), optionally trailing slash.
        if path not in ("", "/"):
            return False, "Only root URLs are allowed (for example: https://example.com)", None
        if parsed.query:
            return False, "Query strings are not allowed in root-only mode", None
        if parsed.fragment:
            return False, "URL fragments are not allowed in root-only mode", None

    # Try to resolve as IP first
    try:
        ip = ipaddress.ip_address(hostname)
        if _is_private_ip(str(ip)):
            return False, "Private or internal IP addresses are not allowed", None
    except ValueError:
        # It's a domain name - resolve it
        try:
            addr_infos = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
            for addr_info in addr_infos:
                ip_str = addr_info[4][0]
                if _is_private_ip(ip_str):
                    return (
                        False,
                        "Domain resolves to a private or internal IP address",
                        None,
                    )
        except socket.gaierror:
            # DNS resolution failed - allow it to be tried by the scoring engine
            # Some valid endpoints may not be resolvable from the platform's DNS
            pass

    # Normalize: lowercase scheme and hostname, keep path/query/fragment
    normalized = (
        f"{parsed.scheme.lower()}://{hostname.lower()}"
        + (f":{parsed.port}" if parsed.port else "")
        + (parsed.path or "")
        + (f"?{parsed.query}" if parsed.query else "")
        + (f"#{parsed.fragment}" if parsed.fragment else "")
    )

    return True, "", normalized
