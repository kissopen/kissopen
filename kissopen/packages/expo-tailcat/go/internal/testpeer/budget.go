package testpeer

import (
	"os"
	"strconv"
	"time"
)

/*
How long a test may wait, scaled for the detector it runs under.

The race detector slows a WireGuard handshake and a body copy by several
times, and every budget in these tests was written for a machine without it.
Five seconds is generous for a loopback tunnel and not enough for the same
tunnel under `-race` on a laptop, which made the suite its own flake: the code
was fine and the clock was not.

Scaling here rather than raising the numbers keeps the plain run strict, which
is the run that would notice a real regression. The factor allows for the
packages running in parallel as well: `go test -p 4 -race ./...` has two
tunnels handshaking and copying bodies at once, and each one gets a share of a
machine the number was measured on alone.
*/
const RaceFactor = 12

// factor is how much slack this run gets. A slower machine than the one a
// number was written on says so through the environment rather than by
// everyone editing the numbers.
func factor() int {
	if v := os.Getenv("TAILCAT_TEST_BUDGET"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	if raceEnabled {
		return RaceFactor
	}
	return 1
}

// Budget scales one duration for the current build.
func Budget(d time.Duration) time.Duration {
	return d * time.Duration(factor())
}

// BudgetMs is the same in milliseconds, for options that travel as JSON.
func BudgetMs(ms int) int {
	return ms * factor()
}
