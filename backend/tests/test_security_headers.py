"""
tests/test_security_headers.py

Regression guard for the app-wide security headers added in main.py. Uses
TestClient WITHOUT the context manager so the app lifespan (DB create_all) is
not invoked — these assertions need no database.
"""

from fastapi.testclient import TestClient

import main

EXPECTED_STATIC = {
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
}


def test_security_headers_present_on_every_response():
    client = TestClient(main.app)  # no `with` -> lifespan/DB not triggered
    r = client.get("/")
    assert r.status_code == 200
    for header, value in EXPECTED_STATIC.items():
        assert r.headers.get(header) == value, f"{header} missing/wrong"
    csp = r.headers.get("content-security-policy")
    assert csp is not None
    assert "default-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp


def test_security_headers_single_valued_and_coexist_with_cors():
    client = TestClient(main.app)
    r = client.get("/", headers={"Origin": "http://localhost:3000"})
    # CORS still works...
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
    # ...and each security header is present exactly once (not duplicated).
    for header in (*EXPECTED_STATIC.keys(), "content-security-policy"):
        assert len(r.headers.get_list(header)) == 1, f"{header} duplicated"
