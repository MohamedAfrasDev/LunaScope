"""Analytic clearance models whose answers are derived by hand, not from production code."""

from __future__ import annotations

import math

import pytest


class SineModel:
    """d(t) = A sin(2 pi (t + shift) / P). Zeros and extrema are known exactly."""

    def __init__(self, A=1.0, P=86400.0, shift=0.0):
        self.A, self.P, self.shift = A, P, shift

    def d(self, t):
        return self.A * math.sin(2 * math.pi * (t + self.shift) / self.P)

    def lipschitz(self, a, b):
        return self.A * 2 * math.pi / self.P

    def monotone(self, a, b):
        # extrema where cos = 0  ->  t = P*(1/4 + k/2) - shift
        k = math.ceil(((a + self.shift) / self.P - 0.25) * 2)
        return self.P * (0.25 + k / 2) - self.shift > b

    def zero_crossings(self, t0, t1):
        out, k = [], math.ceil((t0 + self.shift) / (self.P / 2))
        while True:
            t = k * self.P / 2 - self.shift
            if t > t1:
                return out
            if t >= t0:
                out.append((t, "rise" if k % 2 == 0 else "set"))
            k += 1


class ParabolaModel:
    """d(t) = k (t - c)^2 + m. m<0: hidden dip between two crossings; m=0: tangent."""

    def __init__(self, k, c, m):
        self.k, self.c, self.m = k, c, m

    def d(self, t):
        return self.k * (t - self.c) ** 2 + self.m

    def lipschitz(self, a, b):
        return 2 * self.k * max(abs(a - self.c), abs(b - self.c))

    def monotone(self, a, b):
        return not (a <= self.c <= b)


@pytest.fixture
def sine():
    return SineModel
