"""
tests/test_currency_service.py

Unit tests for services/currency_service.py.

The external provider is ALWAYS mocked (via `_fetch_rates_from_provider`) and the
Redis cache helpers are patched — no real network or Redis access occurs.

Covers:
  - valid PKR → GBP conversion
  - conversion calculation correctness
  - same-currency conversion (no provider call)
  - invalid amount (0 / negative)
  - unsupported / malformed currency
  - provider failure
  - keyless provider success path (parses "rates" + timestamp, no API key)
  - provider non-success result raises
  - cached-rate path (provider NOT called)
  - get_rates returns the visa currencies with a single provider fetch
"""

from unittest.mock import patch

import pytest

import services.currency_service as cs

_FAKE_RATES = {"GBP": 0.00285025, "USD": 0.0036, "CAD": 0.0049, "AUD": 0.0054}
_FAKE_UPDATED = "2026-06-13T00:00:00Z"


def _patch_no_cache():
    """Patch cache so every lookup misses and writes are no-ops."""
    return (
        patch.object(cs, "_cache_get_pair", return_value=None),
        patch.object(cs, "_cache_set_pair"),
    )


# ---------------------------------------------------------------------------
# Conversion happy paths
# ---------------------------------------------------------------------------

def test_valid_pkr_to_gbp_conversion():
    get_p, set_p = _patch_no_cache()
    with get_p, set_p, patch.object(
        cs, "_fetch_rates_from_provider", return_value=(_FAKE_RATES, _FAKE_UPDATED)
    ) as fetch:
        result = cs.convert("PKR", "GBP", 1_000_000)

    fetch.assert_called_once_with("PKR")
    assert result["from"] == "PKR"
    assert result["to"] == "GBP"
    assert result["amount"] == 1_000_000
    assert result["rate"] == round(0.00285025, 8)
    assert result["converted_amount"] == 2850.25  # 1_000_000 * 0.00285025
    assert result["provider"] == cs.PROVIDER_NAME
    assert result["last_updated"] == _FAKE_UPDATED
    assert result["is_estimate"] is True


def test_conversion_calculation_correctness():
    get_p, set_p = _patch_no_cache()
    with get_p, set_p, patch.object(
        cs, "_fetch_rates_from_provider", return_value=({"GBP": 0.003}, _FAKE_UPDATED)
    ):
        result = cs.convert("PKR", "GBP", 250_000)
    assert result["converted_amount"] == 750.0  # 250_000 * 0.003
    assert result["rate"] == 0.003


def test_currency_codes_are_normalized_to_uppercase():
    get_p, set_p = _patch_no_cache()
    with get_p, set_p, patch.object(
        cs, "_fetch_rates_from_provider", return_value=(_FAKE_RATES, _FAKE_UPDATED)
    ):
        result = cs.convert("pkr", "gbp", 1000)
    assert result["from"] == "PKR"
    assert result["to"] == "GBP"


def test_same_currency_conversion_does_not_call_provider():
    with patch.object(cs, "_fetch_rates_from_provider") as fetch:
        result = cs.convert("PKR", "PKR", 5000)
    fetch.assert_not_called()
    assert result["rate"] == 1.0
    assert result["converted_amount"] == 5000.0


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("bad_amount", [0, -1, -1000.5])
def test_invalid_amount_raises(bad_amount):
    with patch.object(cs, "_fetch_rates_from_provider") as fetch:
        with pytest.raises(cs.InvalidAmountError):
            cs.convert("PKR", "GBP", bad_amount)
    fetch.assert_not_called()  # validation happens before any provider call


@pytest.mark.parametrize("bad_code", ["EUR", "JPY", "XX", "POUND", "12A", ""])
def test_unsupported_or_malformed_currency_raises(bad_code):
    with pytest.raises(cs.InvalidCurrencyError):
        cs.convert("PKR", bad_code, 1000)


def test_unsupported_source_currency_raises():
    with pytest.raises(cs.InvalidCurrencyError):
        cs.convert("EUR", "GBP", 1000)


# ---------------------------------------------------------------------------
# Provider / config failures
# ---------------------------------------------------------------------------

def test_provider_failure_propagates():
    get_p, set_p = _patch_no_cache()
    with get_p, set_p, patch.object(
        cs, "_fetch_rates_from_provider", side_effect=cs.CurrencyProviderError("boom")
    ):
        with pytest.raises(cs.CurrencyProviderError):
            cs.convert("PKR", "GBP", 1000)


def test_provider_success_path_is_keyless(monkeypatch):
    # The open endpoint needs no API key: even with EXCHANGE_RATE_API_KEY unset,
    # a success payload parses cleanly. Rates live under "rates" (not
    # "conversion_rates"), and the timestamp comes from time_last_update_unix.
    monkeypatch.delenv("EXCHANGE_RATE_API_KEY", raising=False)

    class _FakeResp:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return (
                b'{"result": "success",'
                b' "time_last_update_unix": 1718236800,'
                b' "rates": {"PKR": 1, "GBP": 0.0028, "USD": 0.0036}}'
            )

    with patch.object(cs, "urlopen", return_value=_FakeResp()):
        rates, last_updated = cs._fetch_rates_from_provider("PKR")

    assert rates["GBP"] == 0.0028
    assert rates["USD"] == 0.0036
    assert last_updated == cs._to_iso(1718236800)  # read from time_last_update_unix


def test_provider_non_success_result_raises():
    class _FakeResp:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return b'{"result": "error", "error-type": "unsupported-code"}'

    with patch.object(cs, "urlopen", return_value=_FakeResp()):
        with pytest.raises(cs.CurrencyProviderError):
            cs._fetch_rates_from_provider("PKR")


# ---------------------------------------------------------------------------
# Cache path
# ---------------------------------------------------------------------------

def test_cached_rate_path_skips_provider():
    cached = {"rate": 0.00285025, "last_updated": _FAKE_UPDATED, "provider": cs.PROVIDER_NAME}
    with patch.object(cs, "_cache_get_pair", return_value=cached), patch.object(
        cs, "_fetch_rates_from_provider"
    ) as fetch:
        result = cs.convert("PKR", "GBP", 1000)
    fetch.assert_not_called()
    assert result["converted_amount"] == round(1000 * 0.00285025, 2)
    assert result["rate"] == 0.00285025


# ---------------------------------------------------------------------------
# get_rates
# ---------------------------------------------------------------------------

def test_get_rates_returns_visa_currencies_with_single_fetch():
    get_p, set_p = _patch_no_cache()
    with get_p, set_p, patch.object(
        cs, "_fetch_rates_from_provider", return_value=(_FAKE_RATES, _FAKE_UPDATED)
    ) as fetch:
        result = cs.get_rates("PKR")

    fetch.assert_called_once_with("PKR")
    assert result["base"] == "PKR"
    assert set(result["rates"].keys()) == {"GBP", "USD", "CAD", "AUD"}
    assert result["rates"]["GBP"] == round(0.00285025, 8)
    assert result["provider"] == cs.PROVIDER_NAME
    assert result["is_estimate"] is True
