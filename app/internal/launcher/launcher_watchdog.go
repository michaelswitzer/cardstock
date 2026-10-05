package launcher

import (
	"sync"
	"time"
)

// Watchdog shuts the app down once the UI is gone. Each heartbeat extends the
// deadline by the idle timeout; a "bye" (page closed) shortens it to a brief
// grace period so a reload or another open tab can still keep the app alive.
type Watchdog struct {
	mu       sync.Mutex
	deadline time.Time
	Idle     time.Duration // max gap between heartbeats (background tabs are throttled)
	Grace    time.Duration // wait after a page closes
}

func NewWatchdog(startup, idle, grace time.Duration) *Watchdog {
	return &Watchdog{deadline: time.Now().Add(startup), Idle: idle, Grace: grace}
}

func (w *Watchdog) Beat() {
	w.mu.Lock()
	w.deadline = time.Now().Add(w.Idle)
	w.mu.Unlock()
}

func (w *Watchdog) Bye() {
	w.mu.Lock()
	if d := time.Now().Add(w.Grace); d.Before(w.deadline) {
		w.deadline = d
	}
	w.mu.Unlock()
}

// Wait blocks until the deadline passes without being extended.
func (w *Watchdog) Wait() {
	for {
		w.mu.Lock()
		d := time.Until(w.deadline)
		w.mu.Unlock()
		if d <= 0 {
			return
		}
		time.Sleep(min(d, time.Second))
	}
}
