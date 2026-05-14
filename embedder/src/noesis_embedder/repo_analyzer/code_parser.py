"""Code analysis and extraction for different programming languages."""

import re
from dataclasses import dataclass
from typing import Literal


Language = Literal["typescript", "javascript", "python", "go", "java"]


@dataclass
class CodeSymbol:
    """A code symbol (function, class, etc.) found in source code."""

    name: str
    """Name of the symbol."""

    kind: Literal["function", "class", "interface", "type", "constant"]
    """Kind of symbol."""

    line_start: int
    """Starting line number (0-indexed)."""

    line_end: int
    """Ending line number (inclusive)."""

    doc_string: str | None = None
    """Optional documentation (JSDoc, docstring, etc.)."""

    is_public: bool = True
    """Whether this symbol is public/exported."""


class CodeParser:
    """Parse code files to extract symbols and APIs."""

    @staticmethod
    def extract_symbols(
        content: str,
        language: Language,
    ) -> list[CodeSymbol]:
        """Extract public symbols (functions, classes) from code.

        Args:
            content: Source code as string.
            language: Programming language.

        Returns:
            List of CodeSymbol objects found in the file.
        """
        if language in ("typescript", "javascript"):
            return CodeParser._extract_ts_symbols(content)
        elif language == "python":
            return CodeParser._extract_py_symbols(content)
        # TODO: Add Go, Java parsers
        return []

    @staticmethod
    def _extract_ts_symbols(content: str) -> list[CodeSymbol]:
        """Extract TypeScript/JavaScript symbols (functions, classes, interfaces)."""
        symbols = []
        lines = content.split("\n")

        # Regex patterns
        export_pattern = r"^export\s+(default\s+)?(async\s+)?(function|class|const|interface|type)\s+(\w+)"
        function_pattern = r"^(async\s+)?(function\s+)?(\w+)\s*\([^)]*\)\s*(?::|=>)"
        class_pattern = r"^class\s+(\w+)"
        interface_pattern = r"^interface\s+(\w+)"
        jsdoc_pattern = r"^/\*\*\s*\n([\s\S]*?)\n\s*\*/"

        i = 0
        while i < len(lines):
            line = lines[i]

            # Look for JSDoc comments
            jsdoc = None
            if line.strip().startswith("/**"):
                doc_lines = []
                j = i
                while j < len(lines):
                    doc_lines.append(lines[j])
                    if "*/" in lines[j]:
                        jsdoc = "\n".join(doc_lines)
                        i = j + 1
                        break
                    j += 1
                if i >= len(lines):
                    break

            # Check for export
            if re.match(export_pattern, line):
                match = re.match(export_pattern, line)
                if match:
                    kind_str = match.group(3)
                    name = match.group(4)
                    kind = CodeParser._ts_kind_to_symbol_kind(kind_str)

                    # Find end of symbol
                    end_line = i + 1
                    if kind_str in ("function", "class"):
                        # Find closing brace
                        brace_count = line.count("{") - line.count("}")
                        while brace_count > 0 and end_line < len(lines):
                            brace_count += (
                                lines[end_line].count("{")
                                - lines[end_line].count("}")
                            )
                            end_line += 1

                    symbol = CodeSymbol(
                        name=name,
                        kind=kind,
                        line_start=i,
                        line_end=end_line - 1,
                        doc_string=jsdoc,
                        is_public=True,
                    )
                    symbols.append(symbol)

            i += 1

        return symbols

    @staticmethod
    def _extract_py_symbols(content: str) -> list[CodeSymbol]:
        """Extract Python symbols (functions, classes)."""
        symbols = []
        lines = content.split("\n")

        docstring_pattern = r'^\s*"""([\s\S]*?)"""'
        function_pattern = r"^def\s+(\w+)\s*\("
        class_pattern = r"^class\s+(\w+)"

        i = 0
        while i < len(lines):
            line = lines[i]

            # Check for function or class at module level (no indent or 0 spaces)
            if not line.startswith(" "):
                # Look for docstring
                docstring = None
                if i > 0 and lines[i - 1].strip().endswith('"""'):
                    pass  # TODO: Extract multi-line docstrings

                # Check for function
                if re.match(function_pattern, line):
                    match = re.match(function_pattern, line)
                    name = match.group(1)

                    # Find end (next def/class at same level)
                    end_line = i + 1
                    while end_line < len(lines) and (
                        lines[end_line].startswith(" ") or lines[end_line].strip() == ""
                    ):
                        end_line += 1

                    symbol = CodeSymbol(
                        name=name,
                        kind="function",
                        line_start=i,
                        line_end=end_line - 1,
                        doc_string=docstring,
                        is_public=not name.startswith("_"),
                    )
                    symbols.append(symbol)

                # Check for class
                elif re.match(class_pattern, line):
                    match = re.match(class_pattern, line)
                    name = match.group(1)

                    # Find end
                    end_line = i + 1
                    while end_line < len(lines) and (
                        lines[end_line].startswith(" ") or lines[end_line].strip() == ""
                    ):
                        end_line += 1

                    symbol = CodeSymbol(
                        name=name,
                        kind="class",
                        line_start=i,
                        line_end=end_line - 1,
                        doc_string=docstring,
                        is_public=not name.startswith("_"),
                    )
                    symbols.append(symbol)

            i += 1

        return symbols

    @staticmethod
    def _ts_kind_to_symbol_kind(
        kind_str: str,
    ) -> Literal["function", "class", "interface", "type", "constant"]:
        """Convert TypeScript keyword to symbol kind."""
        mapping = {
            "function": "function",
            "class": "class",
            "interface": "interface",
            "type": "type",
            "const": "constant",
        }
        return mapping.get(kind_str, "constant")
