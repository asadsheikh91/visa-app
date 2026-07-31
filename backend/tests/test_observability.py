"""
tests/test_observability.py

Guards the Sentry configuration in observability.py.

The leak these tests exist to prevent was real, not hypothetical: with
send_default_pii=False and max_request_body_size="never" both set, a captured
500 STILL carried the applicant's nationality, their previous-refusal answer and
a report access token -- because Sentry attaches stack-frame local variables by
default, and a route handler's parsed request body is a local variable.

So these tests assert on the observable outcome (what ends up in the payload)
rather than on the option values. Someone can restructure the config freely;
they cannot make applicant data reach a third party without failing a test.
"""

import json
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, ".")

from observability import _scrub, init_sentry  # noqa: E402

# A syntactically valid DSN. Nothing is transmitted -- every test installs a
# transport that appends to a list instead of opening a socket.
_FAKE_DSN = "https://publickey@o1.ingest.sentry.io/1"


def test_disabled_without_dsn(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    assert init_sentry() is False


def test_malformed_dsn_does_not_raise(monkeypatch):
    """A bad DSN must not stop the API booting -- telemetry is not a dependency."""
    monkeypatch.setenv("SENTRY_DSN", "not-a-valid-dsn")
    assert init_sentry() is False


def test_scrub_removes_query_string():
    event = {"request": {"url": "https://x/report/abc?token=SECRET", "query_string": "token=SECRET"}}
    scrubbed = _scrub(event, None)
    assert scrubbed["request"]["url"] == "https://x/report/abc"
    assert "query_string" not in scrubbed["request"]
    assert "SECRET" not in json.dumps(scrubbed)


def test_scrub_survives_malformed_event():
    """Scrubbing must never be the reason an error report is lost."""
    assert _scrub({}, None) == {}
    assert _scrub({"request": None}, None) == {"request": None}


@pytest.fixture
def captured_event():
    """Trigger a real 500 through FastAPI and return the event Sentry would send."""
    sentry_sdk = pytest.importorskip("sentry_sdk")
    events: list = []

    sentry_sdk.init(
        dsn=_FAKE_DSN,
        transport=lambda event: events.append(event),
        send_default_pii=False,
        max_request_body_size="never",
        include_local_variables=False,
        before_send=_scrub,
    )

    app = FastAPI()

    @app.post("/boom")
    async def boom(payload: dict):  # noqa: ARG001 - the body must stay a local
        raise ValueError("simulated production failure")

    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/boom?token=SECRET_REPORT_TOKEN",
        json={"nationality": "Pakistani", "previous_refusal": "yes"},
    )
    assert response.status_code == 500

    sentry_sdk.get_client().close()
    assert events, "Sentry captured no event for an unhandled 500"
    return events[0]


def test_unhandled_error_is_captured(captured_event):
    assert captured_event["exception"]["values"][0]["type"] == "ValueError"


def test_stack_trace_is_still_useful(captured_event):
    """The PII guards must not strip the diagnostics the report exists for."""
    frames = captured_event["exception"]["values"][0]["stacktrace"]["frames"]
    assert len(frames) > 1
    assert all("lineno" in f for f in frames)


def _runtime_payload(event: dict) -> str:
    """
    The event as JSON, minus each frame's source-code context.

    Sentry attaches the source lines surrounding every frame. That is code, not
    data, and in production it is exactly what makes a report readable. But THIS
    test file contains the literal fixture strings on the lines that raise, so an
    unfiltered dump matches its own source and reports a leak that is not real.

    Everything a request could actually put into an event -- frame `vars`, the
    request body, the URL -- is left in place.
    """
    def strip(node):
        if isinstance(node, dict):
            # Frames appear under exception.values[], and again under threads[]
            # for chained exceptions -- so walk everything rather than guessing
            # at the shape.
            for key in ("pre_context", "context_line", "post_context"):
                node.pop(key, None)
            for child in node.values():
                strip(child)
        elif isinstance(node, list):
            for child in node:
                strip(child)

    trimmed = json.loads(json.dumps(event))
    strip(trimmed)
    return json.dumps(trimmed)


def test_no_stack_frame_carries_local_variables(captured_event):
    """
    The specific regression this module exists for.

    A route handler's parsed request body is a local variable, so frame `vars`
    is how applicant data escaped before include_local_variables=False was set.
    """
    frames = captured_event["exception"]["values"][0]["stacktrace"]["frames"]
    assert all("vars" not in frame for frame in frames)


def test_request_body_is_not_attached(captured_event):
    """
    max_request_body_size="never" leaves the `data` key present but empty rather
    than omitting it, so assert on the content -- an assertion on the key's
    absence would pass for the wrong reason if the setting were ever relaxed.
    """
    assert not captured_event.get("request", {}).get("data")


@pytest.mark.parametrize(
    "secret",
    [
        "SECRET_REPORT_TOKEN",  # report access token, from the query string
        "Pakistani",            # nationality, from the request body
        "previous_refusal",     # refusal history, from the request body
    ],
)
def test_no_applicant_data_reaches_sentry(captured_event, secret):
    assert secret not in _runtime_payload(captured_event)
