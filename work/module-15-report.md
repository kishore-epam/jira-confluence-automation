# Module 15 Completion Report

## Script Metadata
- Filename: `tools/bulk_file_processor.py`
- Language: Python
- Purpose: Discover matching text files and process each independently through a configurable `module:function` plug-in, writing one JSON result per source file. For this test, `normalize_text_processor:process_text` normalized line endings, trimmed trailing whitespace, and ensured one final newline. `--dry-run` verifies discovery and planned outputs without invoking a plug-in or writing files. The completed instruction validation used Approach 2 — Iterative Rereading; no AI bulk processing was performed through this script.

## Script Contents
```python
"""Process matching text files independently through a configured plug-in."""

from __future__ import annotations

import argparse
import fnmatch
import importlib
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable


Processor = Callable[..., str]


class ConfigurationError(Exception):
    """Raised when an input path or processor configuration is invalid."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Discover matching files and process each independently into a "
            "separate JSON result."
        ),
        epilog=(
            "Rules file format: JSON object with an optional 'processor' value "
            "in 'module:function' form and optional object-valued 'options'. "
            "The configured function must accept (source_text, *, options) "
            "and return a string. Dry-run does not import or invoke it and "
            "does not write files."
        ),
    )
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument(
        "--pattern",
        required=True,
        help='Path.glob pattern relative to input-dir, e.g. "**/*.md".',
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Glob pattern to exclude, matched against the relative path or basename; may be repeated.",
    )
    parser.add_argument("--rules-file", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List every planned file operation without invoking a processor or writing results.",
    )
    return parser.parse_args()


def is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def validate_pattern(pattern: str) -> None:
    normalized = pattern.replace("\\", "/")
    if not normalized or Path(pattern).is_absolute():
        raise ConfigurationError("--pattern must be a non-empty relative glob pattern.")
    if ".." in normalized.split("/"):
        raise ConfigurationError("--pattern must not contain parent-directory segments.")


def read_rules(rules_path: Path) -> dict[str, Any]:
    if not rules_path.exists():
        raise ConfigurationError(f"Rules file does not exist: {rules_path}")
    if not rules_path.is_file():
        raise ConfigurationError(f"Rules path is not a file: {rules_path}")
    try:
        rules = json.loads(rules_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ConfigurationError(f"Cannot read JSON rules file {rules_path}: {exc}") from exc
    if not isinstance(rules, dict):
        raise ConfigurationError("The rules file must contain a JSON object.")
    options = rules.get("options", {})
    if not isinstance(options, dict):
        raise ConfigurationError("The rules file's 'options' value must be a JSON object.")
    return rules


def validate_paths(args: argparse.Namespace) -> tuple[Path, Path, Path, dict[str, Any]]:
    input_dir = args.input_dir.expanduser().resolve()
    rules_path = args.rules_file.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()

    if not input_dir.exists():
        raise ConfigurationError(f"Input directory does not exist: {input_dir}")
    if not input_dir.is_dir():
        raise ConfigurationError(f"Input path is not a directory: {input_dir}")
    if output_dir.exists() and not output_dir.is_dir():
        raise ConfigurationError(f"Output path is not a directory: {output_dir}")
    if output_dir == input_dir or is_within(output_dir, input_dir):
        raise ConfigurationError(
            "--output-dir must be outside --input-dir to protect source files and avoid reprocessing results."
        )

    validate_pattern(args.pattern)
    rules = read_rules(rules_path)
    return input_dir, rules_path, output_dir, rules


def discover_files(
    input_dir: Path,
    pattern: str,
    exclude_patterns: list[str],
    rules_path: Path,
    output_dir: Path,
) -> list[Path]:
    for exclude_pattern in exclude_patterns:
        validate_pattern(exclude_pattern)

    files: list[Path] = []
    for path in input_dir.glob(pattern):
        if not path.is_file():
            continue
        resolved_path = path.resolve()
        if not is_within(resolved_path, input_dir):
            raise ConfigurationError(
                f"Matched file resolves outside --input-dir: {path}"
            )
        relative_path = resolved_path.relative_to(input_dir).as_posix()
        if any(
            fnmatch.fnmatchcase(relative_path, exclude_pattern)
            or fnmatch.fnmatchcase(resolved_path.name, exclude_pattern)
            for exclude_pattern in exclude_patterns
        ):
            continue
        files.append(resolved_path)
    files.sort()
    if not files:
        raise ConfigurationError(
            f"No files matched pattern {pattern!r} under {input_dir}."
        )
    if rules_path in files:
        raise ConfigurationError(
            "The rules file matches --pattern; place it outside --input-dir or use a narrower pattern."
        )
    result_paths = [
        result_path_for(source_path, input_dir, output_dir) for source_path in files
    ]
    normalized_results = [os.path.normcase(str(path)) for path in result_paths]
    if len(normalized_results) != len(set(normalized_results)):
        raise ConfigurationError("Multiple input files map to the same output path.")
    if rules_path in result_paths:
        raise ConfigurationError(
            "A generated result would overwrite the rules file; choose another --output-dir."
        )
    return files


def load_processor(rules: dict[str, Any]) -> Processor:
    processor_spec = rules.get("processor")
    if not isinstance(processor_spec, str) or ":" not in processor_spec:
        raise ConfigurationError(
            "No callable processor is configured. Add 'processor': 'module:function' "
            "to the rules file; no AI provider is bundled."
        )

    module_name, function_path = processor_spec.split(":", 1)
    if not module_name or not function_path:
        raise ConfigurationError(
            "The rules file's 'processor' must use 'module:function' form."
        )
    try:
        target: Any = importlib.import_module(module_name)
        for attribute in function_path.split("."):
            target = getattr(target, attribute)
    except (ImportError, AttributeError) as exc:
        raise ConfigurationError(
            f"Cannot load configured processor {processor_spec!r}: {exc}"
        ) from exc
    if not callable(target):
        raise ConfigurationError(f"Configured processor is not callable: {processor_spec!r}")
    return target


def result_path_for(source_path: Path, input_dir: Path, output_dir: Path) -> Path:
    relative_path = source_path.relative_to(input_dir)
    return output_dir / relative_path.parent / f"{relative_path.name}.result.json"


def write_result(result_path: Path, result: dict[str, Any]) -> None:
    result_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=result_path.parent,
            prefix=f".{result_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = temporary_file.name
            json.dump(result, temporary_file, ensure_ascii=False, indent=2)
            temporary_file.write("\n")
        os.replace(temporary_path, result_path)
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.unlink(temporary_path)


def process_file(
    source_path: Path,
    input_dir: Path,
    output_dir: Path,
    processor: Processor,
    options: dict[str, Any],
) -> tuple[Path, dict[str, Any]]:
    relative_source = source_path.relative_to(input_dir).as_posix()
    result_path = result_path_for(source_path, input_dir, output_dir)
    try:
        source_text = source_path.read_text(encoding="utf-8")
        processed_text = processor(source_text, options=options)
        if not isinstance(processed_text, str):
            raise TypeError("The configured processor must return a string.")
        result = {
            "source_file": relative_source,
            "status": "processed",
            "result": processed_text,
        }
    except Exception as exc:
        result = {
            "source_file": relative_source,
            "status": "failed",
            "error": f"{type(exc).__name__}: {exc}",
        }
    return result_path, result


def run() -> int:
    args = parse_args()
    try:
        input_dir, _rules_path, output_dir, rules = validate_paths(args)
        files = discover_files(
            input_dir,
            args.pattern,
            args.exclude,
            _rules_path,
            output_dir,
        )
        options = rules.get("options", {})

        if args.dry_run:
            for source_path in files:
                relative_source = source_path.relative_to(input_dir).as_posix()
                result_path = result_path_for(source_path, input_dir, output_dir)
                print(f"DRY-RUN {relative_source} -> {result_path}")
            print(f"Discovered {len(files)} matching file(s); no files written.")
            return 0

        processor = load_processor(rules)
    except (ConfigurationError, OSError) as exc:
        print(f"bulk_file_processor: error: {exc}", file=sys.stderr)
        return 2

    failed_count = 0
    for source_path in files:
        result_path, result = process_file(
            source_path,
            input_dir,
            output_dir,
            processor,
            options,
        )
        if result["status"] == "failed":
            failed_count += 1
            print(
                f"Failed to process {result['source_file']}: {result['error']}",
                file=sys.stderr,
            )
        try:
            write_result(result_path, result)
        except OSError as exc:
            failed_count += 1
            print(
                f"Failed to write result for {result['source_file']} to {result_path}: {exc}",
                file=sys.stderr,
            )
            continue
        print(f"{result['status'].upper()} {result['source_file']} -> {result_path}")

    print(
        f"Processed {len(files)} file(s); {failed_count} processing or output error(s)."
    )
    return 1 if failed_count else 0


if __name__ == "__main__":
    raise SystemExit(run())
```

## Parameters
| Parameter | Description | Default |
|-----------|-------------|---------|
| `--input-dir` | Required source directory. | None |
| `--pattern` | Required `Path.glob` pattern, relative to the input directory. | None |
| `--exclude` | Optional glob exclusion matched against relative path or basename; repeatable. | None |
| `--rules-file` | Required JSON rules file. | None |
| `--output-dir` | Required directory for one JSON result per source file. | None |
| `--dry-run` | Discover and list planned outputs without loading the processor or writing files. | False |
| `--help` | Display argparse-generated usage. | N/A |
| `processor` (rules JSON) | Callable plug-in in `module:function` form; required for real processing, not dry-run. No provider is bundled. | None |
| `options` (rules JSON) | Object passed to the configured processor as `options`. | `{}` |

## Test Run Output
The completed instruction validation used Approach 2 — Iterative Rereading. This real test used the deterministic local processor; no AI/LLM or network calls were made.

Command:
```powershell
py tools\bulk_file_processor.py --input-dir work\module15-test-input --pattern "*.md" --rules-file tools\module15_test_rules.json --output-dir work\module15-script-test-output
```

Output:
```text
PROCESSED sample-one.md -> C:\workspace\hello-genai\work\module15-script-test-output\sample-one.md.result.json
PROCESSED sample-two.md -> C:\workspace\hello-genai\work\module15-script-test-output\sample-two.md.result.json
Processed 2 file(s); 0 processing or output error(s).
```

Exit code: `0`. Both input hashes were unchanged, both result files were created, and the existing 12 Approach 2 result files were unchanged.
