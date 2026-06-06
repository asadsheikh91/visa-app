"""
validate_visa_data.py

Validates ParchiVisa visa data files.

Usage:
  # Against Cloudflare R2 (requires R2 env vars):
  python scripts/validate_visa_data.py

  # Against a local data directory:
  python scripts/validate_visa_data.py --local /path/to/parchivisa-data

Validation is split into pure functions so they can be unit-tested without I/O.
"""

import json
import os
import sys
from dataclasses import dataclass
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALLOWED_VISA_TYPES  = {"student_visa"}
ALLOWED_COUNTRIES   = {"student_visa": ["uk", "usa", "canada", "australia"]}
VISA_TYPE_FOLDER    = {"student_visa": "student"}

SUPPORTED_INPUT_TYPES = frozenset({
    "yes_no", "yes_no_unknown", "single_choice", "multi_choice",
    "date", "number", "currency_amount", "text",
})

DEPRECATED_INPUT_TYPES = frozenset({
    "dropdown", "yes_no_unsure", "yes_no_na", "multi_select",
    "yes_no_not_yet", "yes_no_not_sure",
})

SUPPORTED_CONDITION_TYPES = frozenset({
    "any", "never",
    "eq", "neq", "in", "not_in",
    "gte", "gt", "lte", "lt",
    "multi_has_any", "multi_contains",
    "computed_funds_ok",    "computed_funds_short",
    "computed_living_ok",   "computed_living_short",
    "computed_total_ok",    "computed_total_short",
})

# show_if operators (includes multi_contains for multi_choice parent questions)
SUPPORTED_SHOW_IF_OPS = frozenset({
    "eq", "neq", "in", "not_in", "and", "or", "multi_contains",
})

RISK_CATEGORIES = frozenset({"Critical", "High", "Medium", "Low"})
INPUT_TYPES_NEEDING_OPTIONS = frozenset({
    "yes_no", "yes_no_unknown", "single_choice", "multi_choice",
})

REQUIRED_SCORING_SECTIONS = [
    "score_bands", "scoring_categories",
    "critical_blockers_hard", "high_risk_flags", "soft_warnings",
]

# ---------------------------------------------------------------------------
# Issue dataclass
# ---------------------------------------------------------------------------

@dataclass
class Issue:
    country:  str
    filename: str
    item_id:  str
    field:    str
    message:  str
    level:    str   # "error" or "warning"

    def __str__(self):
        loc = self.item_id if self.item_id else "(file level)"
        return "[{}][{}][{}] {}: {}".format(
            self.country, self.filename, loc, self.field, self.message)


# ---------------------------------------------------------------------------
# Shared condition helpers
# ---------------------------------------------------------------------------

def _validate_condition_object(country, filename, qid, field_path, cond):
    """Validates a single pass_if / trigger_if condition dict."""
    issues = []
    if cond is None or cond == {}:
        return issues
    if not isinstance(cond, dict):
        issues.append(Issue(country, filename, qid, field_path,
            "Condition must be a dict or null, got {}: {!r}".format(
                type(cond).__name__, str(cond)[:60]), "error"))
        return issues
    ctype = cond.get("type", "")
    if not ctype:
        return issues
    if ctype not in SUPPORTED_CONDITION_TYPES:
        issues.append(Issue(country, filename, qid, field_path,
            "Unsupported condition type: {!r}. Supported: {}".format(
                ctype, sorted(SUPPORTED_CONDITION_TYPES)), "error"))
    if ctype in ("in", "not_in"):
        val = cond.get("value")
        if val is not None and not isinstance(val, list):
            issues.append(Issue(country, filename, qid, field_path,
                "Condition type {!r} requires a list value, got {}: {!r}".format(
                    ctype, type(val).__name__, val), "error"))
    return issues


def _validate_show_if(country, filename, qid, si, all_q_ids, question):
    """Validates a show_if object (recursive for and/or)."""
    issues = []
    if not isinstance(si, dict):
        issues.append(Issue(country, filename, qid, "show_if",
            "show_if must be null or a structured object, got {}: {!r}".format(
                type(si).__name__, str(si)[:60]), "error"))
        return issues

    op = si.get("operator") or si.get("type", "")

    if op in ("and", "or"):
        for i, sub in enumerate(si.get("conditions", [])):
            if not isinstance(sub, dict):
                issues.append(Issue(country, filename, qid,
                    "show_if.conditions[{}]".format(i),
                    "Nested condition must be a dict", "error"))
            else:
                issues.extend(_validate_show_if(
                    country, filename, qid, sub, all_q_ids, question))
    else:
        if op and op not in SUPPORTED_SHOW_IF_OPS:
            issues.append(Issue(country, filename, qid, "show_if.operator",
                "Unsupported show_if operator: {!r}. Supported: {}".format(
                    op, sorted(SUPPORTED_SHOW_IF_OPS)), "error"))

        ref = si.get("question_id")
        if ref and ref not in all_q_ids:
            issues.append(Issue(country, filename, qid, "show_if.question_id",
                "show_if references non-existent question_id: {!r}".format(ref),
                "error"))

        # Warn if required=True and no not_applicable option (conditional question)
        opts = question.get("options") or []
        opt_values = {o.get("value") for o in opts if isinstance(o, dict)}
        if question.get("required") is True and "not_applicable" not in opt_values:
            issues.append(Issue(country, filename, qid, "show_if/required",
                "Question has show_if but required=True with no not_applicable option. "
                "Add not_applicable option or set required=False.", "warning"))

    return issues


# ---------------------------------------------------------------------------
# Question validator
# ---------------------------------------------------------------------------

def validate_questions(country, questions, scoring_categories, sources_data=None):
    """
    Validates a questions.json list.
    Returns list[Issue].
    """
    issues = []
    filename = "questions.json"

    if not isinstance(questions, list):
        return [Issue(country, filename, "", "",
                      "questions.json must be a JSON array", "error")]

    cat_ids = {c.get("category_id") for c in (scoring_categories or [])
               if c.get("category_id")}

    # Pre-collect all question IDs for cross-reference
    all_q_ids = set()
    for q in questions:
        qid = q.get("id") or q.get("question_id", "")
        if qid:
            all_q_ids.add(qid)

    seen_ids = set()

    for q in questions:
        qid = q.get("id")

        # --- id ---
        if not qid:
            old = q.get("question_id")
            if old:
                issues.append(Issue(country, filename, old, "id",
                    "Field named question_id; rename to id", "error"))
                qid = old
            else:
                issues.append(Issue(country, filename, "", "id",
                    "Question missing required id field", "error"))
                qid = "_unknown_{}".format(id(q))
        elif qid in seen_ids:
            issues.append(Issue(country, filename, qid, "id",
                "Duplicate question id: {!r}".format(qid), "error"))
        seen_ids.add(qid)

        # --- question ---
        if not q.get("question"):
            if q.get("question_text"):
                issues.append(Issue(country, filename, qid, "question",
                    "Field named question_text; rename to question", "error"))
            else:
                issues.append(Issue(country, filename, qid, "question",
                    "Missing or empty question field", "error"))

        # --- help_text ---
        if q.get("help_text") is None:
            if q.get("user_help_text"):
                issues.append(Issue(country, filename, qid, "help_text",
                    "Field named user_help_text; rename to help_text", "error"))
            else:
                issues.append(Issue(country, filename, qid, "help_text",
                    "Missing help_text", "warning"))

        # --- input_type ---
        itype = q.get("input_type")
        if not itype:
            issues.append(Issue(country, filename, qid, "input_type",
                "Missing input_type", "error"))
        elif itype in DEPRECATED_INPUT_TYPES:
            issues.append(Issue(country, filename, qid, "input_type",
                "Deprecated input_type: {!r}. Use: {}".format(
                    itype, sorted(SUPPORTED_INPUT_TYPES)), "error"))
        elif itype not in SUPPORTED_INPUT_TYPES:
            issues.append(Issue(country, filename, qid, "input_type",
                "Unknown input_type: {!r}".format(itype), "error"))

        # --- options ---
        opts = q.get("options") or []
        if opts:
            for i, opt in enumerate(opts):
                if isinstance(opt, str):
                    issues.append(Issue(country, filename, qid,
                        "options[{}]".format(i),
                        "Raw string option {!r}. Options must be label/value dicts.".format(opt),
                        "error"))
                    break
                elif isinstance(opt, dict):
                    for key in ("label", "value"):
                        if key not in opt:
                            issues.append(Issue(country, filename, qid,
                                "options[{}]".format(i),
                                "Option missing {!r} key".format(key), "error"))
        if itype in INPUT_TYPES_NEEDING_OPTIONS and not opts:
            issues.append(Issue(country, filename, qid, "options",
                "input_type={!r} requires a non-empty options array".format(itype),
                "error"))

        # --- validation (pass_if / trigger_if) ---
        v = q.get("validation") or {}
        if v and not isinstance(v, dict):
            issues.append(Issue(country, filename, qid, "validation",
                "validation must be a dict, got {}".format(type(v).__name__), "error"))
        else:
            pass_if    = v.get("pass_if")    if isinstance(v, dict) else None
            trigger_if = v.get("trigger_if") if isinstance(v, dict) else None
            # UK compat: flat pass_if / trigger_if at question level
            if pass_if is None:
                pass_if = q.get("pass_if")
            if trigger_if is None:
                trigger_if = q.get("trigger_if")
            issues.extend(_validate_condition_object(
                country, filename, qid, "validation.pass_if",    pass_if))
            issues.extend(_validate_condition_object(
                country, filename, qid, "validation.trigger_if", trigger_if))

        # --- show_if ---
        si = q.get("show_if")
        if si is not None:
            issues.extend(_validate_show_if(
                country, filename, qid, si, all_q_ids, q))

        # --- scoring_key ---
        sk = q.get("scoring_key")
        if not sk:
            if q.get("score_category"):
                issues.append(Issue(country, filename, qid, "scoring_key",
                    "Field named score_category; rename to scoring_key", "error"))
            else:
                issues.append(Issue(country, filename, qid, "scoring_key",
                    "Missing scoring_key", "error"))
        elif cat_ids and sk not in cat_ids:
            issues.append(Issue(country, filename, qid, "scoring_key",
                "scoring_key {!r} not in scoring_categories {}".format(
                    sk, sorted(cat_ids)), "error"))

        # --- risk_category ---
        rc = q.get("risk_category")
        if not rc:
            if q.get("risk_level"):
                issues.append(Issue(country, filename, qid, "risk_category",
                    "Field named risk_level; rename to risk_category", "error"))
            else:
                issues.append(Issue(country, filename, qid, "risk_category",
                    "Missing risk_category", "error"))
        elif rc not in RISK_CATEGORIES:
            issues.append(Issue(country, filename, qid, "risk_category",
                "risk_category {!r} not in {}".format(rc, sorted(RISK_CATEGORIES)),
                "error"))

        # --- blocker_possible ---
        bp = q.get("blocker_possible")
        if bp is None:
            issues.append(Issue(country, filename, qid, "blocker_possible",
                "Missing blocker_possible", "error"))
        elif not isinstance(bp, bool):
            issues.append(Issue(country, filename, qid, "blocker_possible",
                "blocker_possible must be boolean, got {!r}".format(bp), "error"))

        # --- normalized_answer_format ---
        if not q.get("normalized_answer_format"):
            issues.append(Issue(country, filename, qid, "normalized_answer_format",
                "Missing normalized_answer_format", "error"))

        # --- error_message ---
        if not q.get("error_message"):
            issues.append(Issue(country, filename, qid, "error_message",
                "Missing error_message", "error"))

        # --- source_resolution_status + source_url ---
        srs = q.get("source_resolution_status")
        if not srs:
            issues.append(Issue(country, filename, qid, "source_resolution_status",
                "Missing source_resolution_status", "warning"))
        elif srs == "direct_url" and not q.get("source_url"):
            issues.append(Issue(country, filename, qid, "source_url",
                "source_resolution_status=direct_url but source_url absent", "error"))

        # --- source_ids ---
        sids = q.get("source_ids") or []
        if sids and sources_data is not None:
            known = set(sources_data.get("sources", {}).keys())
            for sid in sids:
                if sid not in known:
                    issues.append(Issue(country, filename, qid, "source_ids",
                        "source_id {!r} not in sources.json".format(sid), "error"))
        elif sids and sources_data is None:
            issues.append(Issue(country, filename, qid, "source_ids",
                "source_ids present but no sources.json available", "warning"))

    return issues


# ---------------------------------------------------------------------------
# Scoring validator
# ---------------------------------------------------------------------------

def validate_scoring(country, scoring, question_ids):
    """Validates a scoring.json dict. Returns list[Issue]."""
    issues = []
    filename = "scoring.json"

    if not isinstance(scoring, dict):
        return [Issue(country, filename, "", "",
                      "scoring.json must be a JSON object", "error")]

    # Old key check
    if "critical_blockers" in scoring and "critical_blockers_hard" not in scoring:
        issues.append(Issue(country, filename, "", "critical_blockers",
            "Found old key critical_blockers; rename to critical_blockers_hard", "error"))

    # Required sections
    for section in REQUIRED_SCORING_SECTIONS:
        if section not in scoring:
            issues.append(Issue(country, filename, "", section,
                "Missing required section: {!r}".format(section), "error"))

    # score_bands
    for i, band in enumerate(scoring.get("score_bands", [])):
        for key in ("min", "max", "label", "description"):
            if key not in band:
                issues.append(Issue(country, filename, "",
                    "score_bands[{}].{}".format(i, key),
                    "score_band missing key {!r}".format(key), "error"))

    # scoring_categories
    cat_ids = set()
    for cat in scoring.get("scoring_categories", []):
        cid = cat.get("category_id")
        if not cid:
            issues.append(Issue(country, filename, "", "scoring_categories",
                "Category missing category_id", "error"))
        elif cid in cat_ids:
            issues.append(Issue(country, filename, cid, "scoring_categories",
                "Duplicate category_id: {!r}".format(cid), "error"))
        else:
            cat_ids.add(cid)
        if "max_points" not in cat:
            issues.append(Issue(country, filename, cid or "", "scoring_categories",
                "Category missing max_points", "error"))
        for qid in cat.get("question_ids", []):
            if qid not in question_ids:
                issues.append(Issue(country, filename, qid,
                    "scoring_categories.question_ids",
                    "Category {!r} refs non-existent question_id: {!r}".format(
                        cid, qid), "error"))

    # Blocker / flag / warning sections
    for section in ("critical_blockers_hard", "high_risk_flags", "soft_warnings"):
        for b in scoring.get(section, []):
            qid = b.get("question_id", "")
            if not qid:
                issues.append(Issue(country, filename, "", section,
                    "{} entry missing question_id".format(section), "error"))
                continue

            if qid not in question_ids:
                issues.append(Issue(country, filename, qid,
                    "{}.question_id".format(section),
                    "{} refs non-existent question_id: {!r}".format(section, qid),
                    "error"))

            ti = b.get("trigger_if") or {}
            issues.extend(_validate_condition_object(
                country, filename, qid, "{}.trigger_if".format(section), ti))

            co = b.get("conditional_on")
            if co is not None:
                if not isinstance(co, dict):
                    issues.append(Issue(country, filename, qid,
                        "{}.conditional_on".format(section),
                        "conditional_on must be null or a dict, got {}: {!r}".format(
                            type(co).__name__, str(co)[:60]), "error"))
                else:
                    ref = co.get("question_id")
                    if ref and ref not in question_ids:
                        issues.append(Issue(country, filename, qid,
                            "{}.conditional_on.question_id".format(section),
                            "conditional_on refs non-existent question_id: {!r}".format(
                                ref), "error"))
                    op = co.get("operator", "")
                    if op and op not in SUPPORTED_SHOW_IF_OPS:
                        issues.append(Issue(country, filename, qid,
                            "{}.conditional_on.operator".format(section),
                            "Unsupported conditional_on operator: {!r}".format(op),
                            "error"))

    # config required if computed_ conditions are used
    config = scoring.get("config")
    has_computed = any(
        (b.get("trigger_if") or {}).get("type", "").startswith("computed_")
        for section in ("critical_blockers_hard", "high_risk_flags")
        for b in scoring.get(section, [])
    )
    if has_computed and not config:
        issues.append(Issue(country, filename, "", "config",
            "Scoring has computed_ conditions but config is empty/absent; "
            "financial thresholds cannot be evaluated.", "error"))

    return issues


# ---------------------------------------------------------------------------
# Sources validator
# ---------------------------------------------------------------------------

def validate_sources(country, questions, sources_data):
    """Validates source_ids in questions against sources.json. Returns list[Issue]."""
    issues = []
    if sources_data is None:
        for q in questions:
            if q.get("source_ids"):
                issues.append(Issue(country, "questions.json",
                    q.get("id", "?"), "source_ids",
                    "source_ids present but no sources.json found", "warning"))
        return issues
    known = set(sources_data.get("sources", {}).keys())
    for q in questions:
        for sid in (q.get("source_ids") or []):
            if sid not in known:
                issues.append(Issue(country, "questions.json",
                    q.get("id", "?"), "source_ids",
                    "source_id {!r} not in sources.json".format(sid), "error"))
    return issues


# ---------------------------------------------------------------------------
# Rules validator
# ---------------------------------------------------------------------------

def validate_rules(country, rules):
    """Validates rules.json. Returns list[Issue]."""
    issues = []
    filename = "rules.json"
    if not isinstance(rules, list):
        return [Issue(country, filename, "", "",
                      "rules.json must be a JSON array", "error")]
    seen = set()
    for rule in rules:
        rid = rule.get("rule_id")
        if not rid:
            issues.append(Issue(country, filename, "", "rule_id",
                "Rule missing rule_id", "error"))
            continue
        if rid in seen:
            issues.append(Issue(country, filename, rid, "rule_id",
                "Duplicate rule_id: {!r}".format(rid), "error"))
        seen.add(rid)
        if not rule.get("rule_name"):
            issues.append(Issue(country, filename, rid, "rule_name",
                "Missing rule_name", "error"))
        if not rule.get("source_url"):
            issues.append(Issue(country, filename, rid, "source_url",
                "Missing source_url", "warning"))
    return issues


# ---------------------------------------------------------------------------
# Country orchestration
# ---------------------------------------------------------------------------

def validate_country(country, questions, scoring, sources_data=None, rules=None):
    """
    Runs all validators for one country.
    Returns (issues, stats_dict).
    """
    issues = []
    sc = scoring.get("scoring_categories", []) if isinstance(scoring, dict) else []
    q_ids = {q.get("id") or q.get("question_id", "")
             for q in questions if isinstance(q, dict)}

    issues.extend(validate_questions(country, questions, sc, sources_data))
    issues.extend(validate_scoring(country, scoring, q_ids))
    issues.extend(validate_sources(country, questions, sources_data))
    if rules is not None:
        issues.extend(validate_rules(country, rules))

    stats = {
        "questions": len(questions) if isinstance(questions, list) else 0,
        "errors":    sum(1 for i in issues if i.level == "error"),
        "warnings":  sum(1 for i in issues if i.level == "warning"),
    }
    return issues, stats


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def _print_report(all_issues, all_stats, countries_checked):
    print()
    errors   = [i for i in all_issues if i.level == "error"]
    warnings = [i for i in all_issues if i.level == "warning"]

    if errors:
        print("ERRORS ({}):".format(len(errors)))
        for i in errors:
            print("  [ERROR] {}".format(i))

    if warnings:
        print()
        print("WARNINGS ({}):".format(len(warnings)))
        for i in warnings:
            print("  [WARN]  {}".format(i))

    print()
    print("-" * 60)
    print("Countries checked : {}".format(countries_checked))
    total_q = sum(s.get("questions", 0) for s in all_stats.values())
    print("Questions checked : {}".format(total_q))
    print("Errors            : {}".format(len(errors)))
    print("Warnings          : {}".format(len(warnings)))
    print("-" * 60)

    if errors:
        print("RESULT: FAIL")
        return False
    print("RESULT: PASS")
    return True


# ---------------------------------------------------------------------------
# Local / R2 runners
# ---------------------------------------------------------------------------

def _run_local(data_path, visa_type="student_visa"):
    folder    = VISA_TYPE_FOLDER[visa_type]
    countries = ALLOWED_COUNTRIES[visa_type]
    all_issues = []
    all_stats  = {}

    print("Validating {} countries under {}".format(len(countries), data_path))

    def load_local(filepath):
        try:
            with open(filepath, encoding="utf-8") as f:
                return json.load(f), None
        except FileNotFoundError:
            return None, "File not found: {}".format(filepath)
        except json.JSONDecodeError as exc:
            return None, "JSON parse error: {}".format(exc)

    for country in countries:
        cpath = os.path.join(data_path, folder, country)
        print("  {}".format(country))

        def load(filename):
            data, err = load_local(os.path.join(cpath, filename))
            if err:
                all_issues.append(Issue(country, filename, "", "", err, "error"))
            return data or ([] if filename == "questions.json" else {})

        questions = load("questions.json")
        scoring   = load("scoring.json")
        rules, _  = load_local(os.path.join(cpath, "rules.json"))
        src_path  = os.path.join(cpath, "sources.json")
        sources   = load_local(src_path)[0] if os.path.exists(src_path) else None

        issues, stats = validate_country(country, questions, scoring, sources, rules)
        all_issues.extend(issues)
        all_stats[country] = stats

        e = stats["errors"]
        w = stats["warnings"]
        status = "OK" if e == 0 else "{} error(s)".format(e)
        if w:
            status += ", {} warning(s)".format(w)
        print("    {} questions -- {}".format(stats["questions"], status))

    return all_issues, all_stats


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Validate ParchiVisa visa data (R2 or local directory)")
    parser.add_argument("--local", metavar="PATH",
        help="Validate from a local directory instead of R2")
    args = parser.parse_args()

    if args.local:
        all_issues, all_stats = _run_local(args.local)
        ok = _print_report(all_issues, all_stats, len(all_stats))
        sys.exit(0 if ok else 1)

    # R2 mode
    try:
        import boto3
        from botocore.config import Config as BotoConfig
        from botocore.exceptions import ClientError, BotoCoreError
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError as exc:
        print("R2 dependencies missing: {}".format(exc))
        sys.exit(1)

    required_env = ("R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")
    missing = [k for k in required_env if not os.environ.get(k)]
    if missing:
        print("Missing env vars: {}".format(", ".join(missing)))
        print("Tip: use --local PATH to validate a local directory.")
        sys.exit(1)

    bucket = os.environ.get("R2_BUCKET_NAME", "visa-app")
    prefix = os.environ.get("R2_PREFIX", "parchivisa-data")
    client = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=BotoConfig(connect_timeout=5, read_timeout=10,
                          retries={"max_attempts": 2, "mode": "standard"}),
    )

    print("Validating ParchiVisa data -- bucket: {}".format(bucket))
    all_issues = []
    all_stats  = {}

    for visa_type, folder in VISA_TYPE_FOLDER.items():
        countries = ALLOWED_COUNTRIES.get(visa_type, [])
        for country in countries:
            print("  {}".format(country))

            def r2_load(filename, _c=country, _f=folder):
                key  = "{}/{}/{}/{}".format(prefix, _f, _c, filename)
                try:
                    from botocore.exceptions import ClientError
                    resp = client.get_object(Bucket=bucket, Key=key)
                    return json.loads(resp["Body"].read().decode("utf-8")), None
                except Exception as exc:
                    return None, str(exc)

            questions = r2_load("questions.json")[0] or []
            scoring   = r2_load("scoring.json")[0]   or {}
            rules     = r2_load("rules.json")[0]
            sources   = r2_load("sources.json")[0]

            issues, stats = validate_country(country, questions, scoring, sources, rules)
            all_issues.extend(issues)
            all_stats[country] = stats

            e = stats["errors"]
            w = stats["warnings"]
            status = "OK" if e == 0 else "{} error(s)".format(e)
            if w:
                status += ", {} warning(s)".format(w)
            print("    {} questions -- {}".format(stats["questions"], status))

    ok = _print_report(all_issues, all_stats, len(all_stats))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
