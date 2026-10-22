"""Version only the two shared-header URL attributes in reviewed public pages."""
import re
from urllib.parse import urlsplit

NAV_VERSION = "nav-20261022-1"
REFERENCE_PAGES = (
    "a320-full-cockpit.html", "a320-single-seat.html", "a320-supershort.html",
    "about.html", "certification-pro.html", "contact.html", "cookie-notice.html",
    "custom-simulator.html", "f16-frames.html", "frames.html", "index.html",
    "legal-notice.html", "mission-scenarios.html", "mission-systems.html",
    "privacy-policy.html", "projects.html", "simstarter-pro-software.html",
    "simstarter.html", "simulators.html", "software.html",
    "terms-and-conditions.html", "visual-systems.html",
)
TAG_PATTERN = re.compile(rb"<(link|script)(?=[\s/>])[^>]*>", re.IGNORECASE)


def versioned_url(value, kind):
    if not isinstance(value, str) or kind not in {"css", "js"}:
        raise RuntimeError("A reviewed shared-header URL is required.")
    parsed = urlsplit(value)
    expected = "assets/" + kind + "/global-header." + kind
    if parsed.path not in {expected, "/" + expected}:
        raise RuntimeError("Only shared-header asset URLs may be versioned.")
    if parsed.scheme not in {"", "https"} or (parsed.netloc and parsed.netloc not in {"www.sim-worx.com", "sim-worx.com"}):
        raise RuntimeError("Header assets must remain on the existing Simworx origin.")
    base, marker, fragment = value.partition("#")
    path, _, query = base.partition("?")
    parameters = [part for part in query.split("&") if part and part.split("=", 1)[0] != "v"]
    parameters.append("v=" + NAV_VERSION)
    return path + "?" + "&".join(parameters) + (marker + fragment if marker else "")


def reference_spans(source, tag, attribute, expected_url):
    matches = []
    expected = expected_url.encode("utf-8")
    attribute_pattern = re.compile(
        rb"(?<![\w:-])" + attribute.encode() + rb"\s*=\s*(?P<quote>[\"'])(?P<url>.*?)(?P=quote)",
        re.IGNORECASE,
    )
    for element in TAG_PATTERN.finditer(source):
        if element.group(1).lower() != tag.encode():
            continue
        for attribute_match in attribute_pattern.finditer(element.group(0)):
            if attribute_match.group("url") == expected:
                matches.append((element.start() + attribute_match.start("url"), element.start() + attribute_match.end("url")))
    return matches


def patch_header_references(source, css_url, js_url):
    replacements = []
    for tag, attribute, kind, value in (("link", "href", "css", css_url), ("script", "src", "js", js_url)):
        matches = reference_spans(source, tag, attribute, value)
        if len(matches) != 1:
            raise RuntimeError("Exactly one reviewed " + kind + " header URL attribute is required.")
        replacements.append((*matches[0], versioned_url(value, kind).encode("utf-8")))
    result = source
    for start, end, replacement in sorted(replacements, reverse=True):
        result = result[:start] + replacement + result[end:]
    return result
