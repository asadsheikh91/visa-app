"""
tests/test_org_rules.py

Module 5 pure rules: roles, seats, email normalization, consent gate.
"""

from services.org_rules import (
    normalize_email, is_valid_role, can_manage_clients,
    client_limit_for_plan, is_seat_available, can_view_client,
)


def test_normalize_email():
    assert normalize_email("  Foo@Bar.COM ") == "foo@bar.com"
    assert normalize_email(None) == ""


def test_roles():
    assert is_valid_role("owner")
    assert is_valid_role("consultant")
    assert not is_valid_role("student")
    assert not is_valid_role(None)


def test_can_manage_clients():
    assert can_manage_clients("owner")
    assert can_manage_clients("consultant")
    assert can_manage_clients("admin")
    assert not can_manage_clients("member")
    assert not can_manage_clients(None)


def test_client_limit_for_plan():
    assert client_limit_for_plan("team") == 5
    assert client_limit_for_plan("pro") == 200
    assert client_limit_for_plan("unknown") == 5   # default
    assert client_limit_for_plan(None) == 5


def test_is_seat_available():
    assert is_seat_available(4, "team") is True     # 4 < 5
    assert is_seat_available(5, "team") is False    # at limit
    assert is_seat_available(150, "pro") is True


def test_can_view_client_consent_gate():
    assert can_view_client("active") is True
    assert can_view_client("invited") is False
    assert can_view_client("declined") is False
    assert can_view_client(None) is False
