from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class CapabilityResult:
    capability: str
    status: str
    evidence: tuple[str, ...]
    failures: tuple[str, ...]


@dataclass(frozen=True)
class CapabilityAdapter:
    capability: str
    verify: Callable[[dict], CapabilityResult]


def require(condition: bool, failure: str, failures: list[str]) -> None:
    if not condition:
        failures.append(failure)


def finish(capability: str, evidence: list[str], failures: list[str]) -> CapabilityResult:
    return CapabilityResult(
        capability=capability,
        status="pass" if not failures else "fail",
        evidence=tuple(evidence),
        failures=tuple(failures),
    )
