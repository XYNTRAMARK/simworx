"""Replace only the two pinned, legacy header blocks in the public configurator."""
import hashlib

from header_references import NAV_VERSION

LEGACY_PAGE_SHA256 = "e953f572b5021706a84dfa7105de3b4ab3686379ca9fc9e03c2b0cc9621d516f"
SHARED_PAGE_SHA256 = "dec652f01b4c5d87393024df14b3e95d6cdd67c292d806697f0fcbd5fde67a19"
CSS_LINK = ('<link rel="stylesheet" href="/assets/css/global-header.css?v=' + NAV_VERSION + '">').encode()
JS_LINK = ('<script src="/assets/js/global-header.js?v=' + NAV_VERSION + '"></script>').encode()
HEADER_REPLACEMENTS = (
    (b"style", "7b6d237a089e9e3db587de9ca56cea067dfed28a193b4c1bdad602c66d22eba7", CSS_LINK),
    (b"script", "03f2b01aba2caabf112339f70f091fa4ad4df9b8dc27b688f849958b3b7284bd", JS_LINK),
)


def digest(body):
    return hashlib.sha256(body).hexdigest()


def matching_blocks(source, tag, expected_sha):
    """Locate exact tag blocks by their whole-block checksum; never rewrite broadly."""
    opening, closing = b"<" + tag + b">", b"</" + tag + b">"
    found = []
    cursor = 0
    while True:
        start = source.find(opening, cursor)
        if start < 0:
            return found
        end = source.find(closing, start + len(opening))
        if end < 0:
            raise RuntimeError("An inline header candidate has no closing tag.")
        end += len(closing)
        if digest(source[start:end]) == expected_sha:
            found.append((start, end))
        cursor = end


def validate_shared_header(source):
    if source.count(CSS_LINK) != 1 or source.count(JS_LINK) != 1:
        raise RuntimeError("The configurator must reference each shared header asset exactly once.")
    if any(matching_blocks(source, tag, sha) for tag, sha, _ in HEADER_REPLACEMENTS):
        raise RuntimeError("A legacy inline header block remains in the configurator.")


def externalise_configurator_header(source):
    if digest(source) != LEGACY_PAGE_SHA256:
        raise RuntimeError("The configurator changed since the reviewed navigation baseline.")
    replacements = []
    for tag, sha, replacement in HEADER_REPLACEMENTS:
        matches = matching_blocks(source, tag, sha)
        if len(matches) != 1:
            raise RuntimeError("Exactly one pinned " + tag.decode() + " header block is required.")
        replacements.append((*matches[0], replacement))
    result = source
    for start, end, replacement in sorted(replacements, reverse=True):
        result = result[:start] + replacement + result[end:]
    if digest(result) != SHARED_PAGE_SHA256:
        raise RuntimeError("The configurator header-only patch failed its reviewed output checksum.")
    validate_shared_header(result)
    return result
