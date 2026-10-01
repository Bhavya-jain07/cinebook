import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, socket, friendlyError } from "../lib/api";
import { Movie, Seat, SeatEvent, Showtime, Theater } from "../lib/types";
import { Navbar } from "../components/Navbar";
import { useToast } from "../components/Toast";

type SessionState = { status: "checking" } | { status: "queued"; position: number; queueLength: number } | { status: "active" };
type Phase = "selecting" | "held" | "confirming" | "confirmed";

export function SeatSelection() {
  const { id } = useParams();
  const showtimeId = id!;
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [session, setSession] = useState<SessionState>({ status: "checking" });
  const [showtime, setShowtime] = useState<Showtime | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>("selecting");
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const loadSeatMap = useCallback(async () => {
    const res = await api.get(`/showtimes/${showtimeId}`);
    setShowtime(res.data.showtime);
    setSeats(res.data.seats);
  }, [showtimeId]);

  // ---------- Step 1: request a session slot (waiting room) ----------
  useEffect(() => {
    let poll: ReturnType<typeof setInterval>;

    async function checkSession() {
      try {
        const res = await api.post(`/showtimes/${showtimeId}/session`);
        if (res.data.status === "active") {
          setSession({ status: "active" });
          clearInterval(poll);
        } else {
          setSession({ status: "queued", position: res.data.position, queueLength: res.data.queueLength });
        }
      } catch (err: any) {
        showToast(friendlyError(err), "error");
      }
    }

    checkSession();
    poll = setInterval(checkSession, 3000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showtimeId]);

  // ---------- Step 2: once active, load seat map + connect live updates ----------
  useEffect(() => {
    if (session.status !== "active") return;
    loadSeatMap();

    socket.connect();
    socket.emit("join_showtime", showtimeId);

    function onSeatEvent(event: SeatEvent) {
      setSeats((prev) =>
        prev.map((s) => {
          if (event.type === "seat_held" && s.id === event.seat && s.status === "available") {
            return { ...s, status: "held" };
          }
          if (event.type === "seat_released" && s.id === event.seat && s.status === "held") {
            return { ...s, status: "available" };
          }
          if (event.type === "seat_booked" && event.seats.includes(s.id)) {
            return { ...s, status: "booked" };
          }
          return s;
        })
      );
    }
    socket.on("seat_event", onSeatEvent);

    return () => {
      socket.off("seat_event", onSeatEvent);
      socket.emit("leave_showtime", showtimeId);
      socket.disconnect();
    };
  }, [session.status, showtimeId, loadSeatMap]);

  // ---------- Release held seats / end session on unmount, if not confirmed ----------
  useEffect(() => {
    return () => {
      if (phase === "held" && selected.size > 0) {
        api.post(`/showtimes/${showtimeId}/release`, { seats: Array.from(selected) }).catch(() => {});
      }
      api.delete(`/showtimes/${showtimeId}/session`).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown tick
  useEffect(() => {
    if (!holdExpiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [holdExpiresAt]);

  function toggleSeat(seat: Seat) {
    if (seat.status !== "available" && !selected.has(seat.id)) return;
    if (seat.status === "booked" || seat.status === "held") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else {
        if (next.size >= 10) {
          showToast("Max 10 seats per booking", "error");
          return prev;
        }
        next.add(seat.id);
      }
      return next;
    });
  }

  async function proceedToHold() {
    if (selected.size === 0) return;
    try {
      const res = await api.post(`/showtimes/${showtimeId}/hold`, { seats: Array.from(selected) });
      setHoldExpiresAt(Date.now() + res.data.expiresInSeconds * 1000);
      setPhase("held");
    } catch (err: any) {
      showToast(friendlyError(err), "error");
      await loadSeatMap(); // someone beat us to a seat — refresh to show current state
    }
  }

  async function confirmBooking() {
    setPhase("confirming");
    try {
      await api.post("/bookings/confirm", {
        showtimeId,
        seats: Array.from(selected),
        idempotencyKey: idempotencyKeyRef.current,
      });
      setPhase("confirmed");
      showToast("Booking confirmed!");
    } catch (err: any) {
      showToast(friendlyError(err), "error");
      setPhase("held");
    }
  }

  // ---------- Waiting room UI ----------
  if (session.status === "checking") {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-md mx-auto px-5 py-20 text-center text-cinema-muted text-sm">Checking availability…</div>
      </div>
    );
  }

  if (session.status === "queued") {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-md mx-auto px-5 py-20 text-center">
          <div className="w-16 h-16 rounded-full border-4 border-cinema-red border-t-transparent animate-spin mx-auto mb-6" />
          <h2 className="font-display text-2xl tracking-wide mb-2">YOU'RE IN THE QUEUE</h2>
          <p className="text-cinema-muted text-sm mb-1">
            Position <span className="text-cinema-text font-semibold">{session.position}</span> of{" "}
            {session.queueLength}
          </p>
          <p className="text-cinema-muted text-xs mt-4">
            This showtime is in high demand — we'll let you in automatically as soon as a spot opens up.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "confirmed") {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-md mx-auto px-5 py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-cinema-red/15 border border-cinema-red flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cinema-red">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h2 className="font-display text-2xl tracking-wide mb-2">BOOKING CONFIRMED</h2>
          <p className="text-cinema-muted text-sm mb-6">
            Seats {Array.from(selected).join(", ")} are yours. Enjoy the show!
          </p>
          <button
            onClick={() => navigate("/my-bookings")}
            className="bg-cinema-red text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-cinema-redDark transition"
          >
            View my bookings
          </button>
        </div>
      </div>
    );
  }

  const movie = showtime?.movieId as Movie | undefined;
  const theater = showtime?.theaterId as Theater | undefined;
  const secondsLeft = holdExpiresAt ? Math.max(0, Math.floor((holdExpiresAt - now) / 1000)) : 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const rows = showtime ? Array.from({ length: showtime.rows }, (_, i) => String.fromCharCode(65 + i)) : [];
  const totalAmount = seats.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-3xl mx-auto px-5 py-8">
        {movie && (
          <div className="mb-6">
            <h1 className="font-display text-2xl tracking-wide">{movie.title}</h1>
            <p className="text-xs text-cinema-muted mt-1">
              {theater?.name} · {showtime && new Date(showtime.dateTime).toLocaleString()}
            </p>
          </div>
        )}

        {phase === "held" && (
          <div className="flex items-center justify-between bg-cinema-red/10 border border-cinema-red/40 rounded-lg px-4 py-2.5 mb-6 text-sm">
            <span className="text-cinema-text">Seats held — complete payment before the timer runs out</span>
            <span className="font-mono font-semibold text-cinema-red">
              {mins}:{String(secs).padStart(2, "0")}
            </span>
          </div>
        )}

        {/* Screen indicator */}
        <div className="mb-8">
          <div className="h-2 bg-gradient-to-r from-transparent via-cinema-muted/40 to-transparent rounded-full mb-1" />
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-cinema-muted">Screen this way</p>
        </div>

        {/* Seat grid */}
        <div className="flex flex-col items-center gap-2 mb-8 overflow-x-auto">
          {rows.map((rowLetter) => (
            <div key={rowLetter} className="flex items-center gap-2">
              <span className="w-4 text-xs text-cinema-muted">{rowLetter}</span>
              <div className="flex gap-1.5">
                {seats
                  .filter((s) => s.id.startsWith(rowLetter) && /^\d+$/.test(s.id.slice(rowLetter.length)))
                  .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
                  .map((seat) => {
                    const isSelected = selected.has(seat.id);
                    const disabled = phase !== "selecting" || (seat.status !== "available" && !isSelected);
                    return (
                      <button
                        key={seat.id}
                        disabled={disabled}
                        onClick={() => toggleSeat(seat)}
                        title={`${seat.id} — ₹${seat.price}${seat.isPremium ? " (premium)" : ""}`}
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-t-md text-[9px] flex items-center justify-center font-medium transition ${
                          isSelected
                            ? "bg-cinema-red text-white"
                            : seat.status === "booked"
                            ? "bg-cinema-surfaceLight text-cinema-muted/30 cursor-not-allowed"
                            : seat.status === "held"
                            ? "bg-cinema-gold/30 text-cinema-gold cursor-not-allowed"
                            : seat.isPremium
                            ? "bg-cinema-surfaceLight border border-cinema-gold/40 hover:border-cinema-gold text-cinema-gold"
                            : "bg-cinema-surfaceLight border border-cinema-border hover:border-cinema-red"
                        }`}
                      >
                        {seat.id.slice(rowLetter.length)}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 text-xs text-cinema-muted mb-8">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cinema-surfaceLight border border-cinema-border inline-block" /> Available</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cinema-red inline-block" /> Selected</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cinema-gold/30 inline-block" /> Held by another user</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-cinema-surfaceLight inline-block opacity-40" /> Booked</span>
        </div>

        {/* Bottom action bar */}
        {selected.size > 0 && (
          <div className="sticky bottom-4 bg-cinema-surface border border-cinema-border rounded-xl p-4 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-sm font-semibold">{selected.size} seat{selected.size > 1 ? "s" : ""} · ₹{totalAmount}</p>
              <p className="text-xs text-cinema-muted">{Array.from(selected).join(", ")}</p>
            </div>
            {phase === "selecting" && (
              <button
                onClick={proceedToHold}
                className="bg-cinema-red text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-cinema-redDark transition"
              >
                Proceed
              </button>
            )}
            {phase === "held" && (
              <button
                onClick={confirmBooking}
                className="bg-cinema-red text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-cinema-redDark transition"
              >
                Confirm &amp; Pay
              </button>
            )}
            {phase === "confirming" && (
              <span className="text-sm text-cinema-muted px-5 py-2.5">Processing…</span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
