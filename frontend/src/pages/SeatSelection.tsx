import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, socket, friendlyError } from "../lib/api";
import { Movie, Seat, SeatEvent, Showtime, Theater } from "../lib/types";
import { formatDateLong, formatTime } from "../lib/format";
import { Navbar } from "../components/Navbar";
import { useToast } from "../components/Toast";

type SessionState = { status: "checking" } | { status: "queued"; position: number; queueLength: number } | { status: "active" };
type Phase = "selecting" | "held" | "confirming" | "confirmed";

function seatClass(seat: Seat, isSelected: boolean) {
  if (isSelected) return "seat-selected";
  if (seat.status === "booked") return "seat-booked";
  if (seat.status === "held") return "seat-held";
  return seat.isPremium ? "seat-premium" : "seat-available";
}

function Swatch({ cls }: { cls: string }) {
  return <span className={`seat inline-block h-5 w-5 ${cls}`} aria-hidden="true" />;
}

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
  const [holdTotal, setHoldTotal] = useState(600);
  const [now, setNow] = useState(Date.now());
  const [bookingRef, setBookingRef] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [lastEvent, setLastEvent] = useState<string>("");
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  // Refs mirror state so the unmount cleanup sees current values, not the first render's.
  const phaseRef = useRef<Phase>(phase);
  const selectedRef = useRef<Set<string>>(selected);
  phaseRef.current = phase;
  selectedRef.current = selected;

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

    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setLive(socket.connected);

    function pulse(ids: string[]) {
      setFlash((prev) => new Set([...prev, ...ids]));
      setTimeout(() => {
        setFlash((prev) => {
          const next = new Set(prev);
          ids.forEach((i) => next.delete(i));
          return next;
        });
      }, 900);
    }

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

      // Visual cue + plain-text announcement for changes made by other people.
      if (event.type === "seat_booked") {
        const others = event.seats.filter((s) => !selectedRef.current.has(s));
        if (others.length) {
          pulse(others);
          setLastEvent(`${others.join(", ")} just booked by someone else`);
        }
      } else if (!selectedRef.current.has(event.seat)) {
        pulse([event.seat]);
        setLastEvent(event.type === "seat_held" ? `${event.seat} was just held by someone else` : `${event.seat} is available again`);
      }
    }
    socket.on("seat_event", onSeatEvent);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("seat_event", onSeatEvent);
      socket.emit("leave_showtime", showtimeId);
      socket.disconnect();
      setLive(false);
    };
  }, [session.status, showtimeId, loadSeatMap]);

  // ---------- Release held seats / end session on unmount, if not confirmed ----------
  useEffect(() => {
    return () => {
      if (phaseRef.current === "held" && selectedRef.current.size > 0) {
        api.post(`/showtimes/${showtimeId}/release`, { seats: Array.from(selectedRef.current) }).catch(() => {});
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

  // When the hold runs out, send the user back to selecting instead of leaving a dead "Confirm" button.
  useEffect(() => {
    if (phase !== "held" || !holdExpiresAt || now < holdExpiresAt) return;
    setPhase("selecting");
    setSelected(new Set());
    setHoldExpiresAt(null);
    idempotencyKeyRef.current = crypto.randomUUID();
    loadSeatMap();
    showToast("Your hold expired. Pick your seats again.", "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, phase, holdExpiresAt]);

  function toggleSeat(seat: Seat) {
    if (seat.status !== "available" && !selected.has(seat.id)) return;
    if (seat.status === "booked" || seat.status === "held") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else {
        if (next.size >= 10) {
          showToast("You can book up to 10 seats at a time.", "error");
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
      setHoldTotal(res.data.expiresInSeconds);
      setNow(Date.now());
      setHoldExpiresAt(Date.now() + res.data.expiresInSeconds * 1000);
      setPhase("held");
    } catch (err: any) {
      showToast(friendlyError(err), "error");
      await loadSeatMap(); // someone beat us to a seat — refresh to show current state
    }
  }

  async function changeSeats() {
    const ids = Array.from(selected);
    api.post(`/showtimes/${showtimeId}/release`, { seats: ids }).catch(() => {});
    setSeats((prev) => prev.map((s) => (selected.has(s.id) && s.status === "held" ? { ...s, status: "available" } : s)));
    setHoldExpiresAt(null);
    setPhase("selecting");
  }

  async function confirmBooking() {
    setPhase("confirming");
    try {
      const res = await api.post("/bookings/confirm", {
        showtimeId,
        seats: Array.from(selected),
        idempotencyKey: idempotencyKeyRef.current,
      });
      setBookingRef(res.data?.booking?._id ?? null);
      setPhase("confirmed");
      showToast("Booking confirmed.");
    } catch (err: any) {
      showToast(friendlyError(err), "error");
      setPhase("held");
    }
  }

  const movie = showtime?.movieId as Movie | undefined;
  const theater = showtime?.theaterId as Theater | undefined;

  const rowLetters = useMemo(() => (showtime ? Array.from({ length: showtime.rows }, (_, i) => String.fromCharCode(65 + i)) : []), [showtime]);
  const seatsByRow = useMemo(() => {
    const map = new Map<string, Seat[]>();
    for (const letter of rowLetters) {
      map.set(
        letter,
        seats
          .filter((s) => s.id.startsWith(letter) && /^\d+$/.test(s.id.slice(letter.length)))
          .sort((a, b) => Number(a.id.slice(letter.length)) - Number(b.id.slice(letter.length)))
      );
    }
    return map;
  }, [seats, rowLetters]);

  const chosen = seats.filter((s) => selected.has(s.id));
  const totalAmount = chosen.reduce((sum, s) => sum + s.price, 0);
  const premiumCount = chosen.filter((s) => s.isPremium).length;
  const regularCount = chosen.length - premiumCount;
  const premiumTotal = chosen.filter((s) => s.isPremium).reduce((a, s) => a + s.price, 0);
  const regularTotal = totalAmount - premiumTotal;

  const secondsLeft = holdExpiresAt ? Math.max(0, Math.floor((holdExpiresAt - now) / 1000)) : 0;
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const urgent = phase === "held" && secondsLeft <= 60;
  const progress = holdTotal > 0 ? Math.min(100, (secondsLeft / holdTotal) * 100) : 0;

  const regularPrice = showtime?.regularPrice;
  const premiumPrice = showtime?.premiumPrice;

  // ---------- Waiting room ----------
  if (session.status === "checking") {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-md px-5 py-28 text-center text-dust" role="status">
          <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-marquee border-t-transparent" />
          Checking availability…
        </div>
      </div>
    );
  }

  if (session.status === "queued") {
    const ahead = Math.max(0, session.position - 1);
    const dots = Math.min(session.queueLength, 14);
    const you = Math.min(session.position, dots);
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-md px-5 py-20 text-center">
          <p className="text-sm text-dust">This showtime is busy, so we're letting people in one by one.</p>
          <p className="display mt-4 text-[120px] text-marquee" aria-live="polite">
            {session.position}
          </p>
          <h1 className="display text-4xl">{ahead === 0 ? "You're next" : `${ahead} ${ahead === 1 ? "person" : "people"} ahead of you`}</h1>

          <div className="mt-8 flex items-center justify-center gap-1.5" aria-hidden="true">
            {Array.from({ length: dots }).map((_, i) => (
              <span key={i} className={`h-3 w-3 rounded-full ${i + 1 === you ? "animate-pulseDot bg-marquee" : "bg-paper/20"}`} />
            ))}
          </div>

          <p className="mt-8 text-sm leading-relaxed text-dust">
            Keep this tab open. We check your spot every few seconds and will open the seat map automatically.
          </p>
          <button onClick={() => navigate(-1)} className="mt-6 text-sm font-semibold text-paper/70 underline-offset-4 hover:text-paper hover:underline">
            Leave the queue
          </button>
        </div>
      </div>
    );
  }

  // ---------- Confirmed ----------
  if (phase === "confirmed") {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-md px-5 py-14">
          <p className="display mb-6 text-center text-6xl text-marquee">You're going.</p>
          <div className="ticket animate-rise">
            <div className="p-6 pb-7">
              <h2 className="display text-4xl">{movie?.title}</h2>
              <p className="mt-1">{theater?.name}</p>
              {showtime && (
                <p className="text-sm opacity-70">
                  {formatDateLong(showtime.dateTime)} at {formatTime(showtime.dateTime)}, {showtime.screenName}
                </p>
              )}
            </div>
            <div className="perf-h px-6 py-5">
              <p className="text-xs font-semibold opacity-70">Seats</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Array.from(selected).map((s) => (
                  <span key={s} className="rounded bg-[#2a0c19] px-2 py-1 text-sm font-bold text-paper">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-70">Paid</p>
                  <p className="text-2xl font-extrabold">₹{totalAmount}</p>
                </div>
                {bookingRef && (
                  <div className="text-right">
                    <p className="text-xs font-semibold opacity-70">Booking reference</p>
                    <p className="font-bold">{bookingRef.slice(-8).toUpperCase()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => navigate("/my-bookings")} className="flex-1 rounded-full bg-marquee py-3 font-bold text-pit transition hover:brightness-110">
              View my bookings
            </button>
            <button onClick={() => navigate("/")} className="flex-1 rounded-full border border-paper/25 py-3 font-bold transition hover:bg-velvet">
              Back to movies
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Seat map ----------
  const actions = (
    <>
      {phase === "selecting" && (
        <button
          onClick={proceedToHold}
          disabled={selected.size === 0}
          className="w-full rounded-full bg-[#2a0c19] py-3 font-bold text-paper transition enabled:hover:bg-black disabled:opacity-40"
        >
          Hold seats for 10 minutes
        </button>
      )}
      {phase === "held" && (
        <div className="space-y-2">
          <button onClick={confirmBooking} className="w-full rounded-full bg-[#2a0c19] py-3 font-bold text-paper transition hover:bg-black">
            Confirm and pay ₹{totalAmount}
          </button>
          <button onClick={changeSeats} className="w-full py-1.5 text-sm font-semibold underline-offset-4 hover:underline">
            Change seats
          </button>
        </div>
      )}
      {phase === "confirming" && (
        <button disabled className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2a0c19] py-3 font-bold text-paper opacity-80">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper border-t-transparent" />
          Confirming…
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen pb-40 lg:pb-0">
      <Navbar />

      <div className="folds">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-5 pb-6 pt-8">
          <div>
            <h1 className="display text-5xl sm:text-6xl">{movie?.title ?? "Loading…"}</h1>
            {showtime && (
              <p className="mt-2 text-dust">
                {theater?.name}, {formatDateLong(showtime.dateTime)} at {formatTime(showtime.dateTime)}, {showtime.screenName}
              </p>
            )}
          </div>
          <span
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${
              live ? "border-glow/50 text-glow" : "border-paper/20 text-dust"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${live ? "animate-pulseDot bg-glow" : "bg-dust"}`} />
            {live ? "Seats update live" : "Reconnecting…"}
          </span>
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[1fr_340px]">
        <section aria-label="Seat map" className="min-w-0">
          {/* Screen */}
          <div className="relative mx-auto mb-4 max-w-2xl" aria-hidden="true">
            <svg viewBox="0 0 400 36" className="relative w-full">
              <defs>
                <linearGradient id="screen" x1="0" x2="1">
                  <stop offset="0" stopColor="#9fd8f0" stopOpacity="0" />
                  <stop offset=".5" stopColor="#d9f2ff" />
                  <stop offset="1" stopColor="#9fd8f0" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M8 32 Q200 2 392 32" stroke="url(#screen)" strokeWidth="4" fill="none" strokeLinecap="round" />
            </svg>
            <div className="mx-auto -mt-1 h-28 w-[88%] bg-gradient-to-b from-glow/25 to-transparent [clip-path:polygon(6%_0,94%_0,100%_100%,0_100%)]" />
            <p className="-mt-24 text-center text-xs font-semibold tracking-wide text-glow/70">Screen</p>
          </div>

          {/* Seat grid */}
          <div className="overflow-x-auto pb-2">
            <div className="mx-auto flex w-max flex-col gap-2 px-1 pt-8">
              {rowLetters.map((letter) => {
                const row = seatsByRow.get(letter) ?? [];
                const aisleAfter = Math.floor((showtime?.seatsPerRow ?? 0) / 2);
                return (
                  <div key={letter} className="flex items-center gap-2" role="group" aria-label={`Row ${letter}`}>
                    <span className="w-4 text-xs font-bold text-dust" aria-hidden="true">
                      {letter}
                    </span>
                    <div className="flex gap-1 sm:gap-1.5">
                      {row.map((seat, idx) => {
                        const isSelected = selected.has(seat.id);
                        const disabled = phase !== "selecting" || (seat.status !== "available" && !isSelected);
                        const number = seat.id.slice(letter.length);
                        const state = isSelected ? "selected" : seat.status === "held" ? "held by someone else" : seat.status;
                        return (
                          <button
                            key={seat.id}
                            disabled={disabled}
                            onClick={() => toggleSeat(seat)}
                            aria-pressed={isSelected}
                            aria-label={`Seat ${seat.id}, ${seat.isPremium ? "premium" : "regular"}, ₹${seat.price}, ${state}`}
                            title={`${seat.id}, ₹${seat.price}${seat.isPremium ? " (premium)" : ""}`}
                            className={`seat flex h-[26px] w-[26px] items-center justify-center text-[10px] font-semibold disabled:cursor-not-allowed sm:h-9 sm:w-9 sm:text-[11px] ${seatClass(seat, isSelected)} ${
                              flash.has(seat.id) ? "seat-flash" : ""
                            } ${idx === aisleAfter ? "ml-3 sm:ml-5" : ""}`}
                          >
                            {number}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-4 h-5 text-center text-sm text-glow" aria-live="polite">
            {lastEvent}
          </p>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-dust">
            <span className="flex items-center gap-2">
              <Swatch cls="seat-available" /> Regular{regularPrice ? ` ₹${regularPrice}` : ""}
            </span>
            <span className="flex items-center gap-2">
              <Swatch cls="seat-premium" /> Premium{premiumPrice ? ` ₹${premiumPrice}` : ""}
            </span>
            <span className="flex items-center gap-2">
              <Swatch cls="seat-selected" /> Your pick
            </span>
            <span className="flex items-center gap-2">
              <Swatch cls="seat-held" /> Held by someone else
            </span>
            <span className="flex items-center gap-2">
              <Swatch cls="seat-booked" /> Booked
            </span>
          </div>
        </section>

        {/* Ticket summary (desktop) */}
        <aside className="hidden lg:block">
          <div className="ticket sticky top-24">
            <div className="p-6 pb-7">
              <h2 className="display text-3xl">Your ticket</h2>
              <p className="mt-1 text-sm opacity-70">{movie?.title}</p>

              {phase === "held" && (
                <div className="mt-4" role="timer" aria-label="Time left to pay">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{urgent ? "Hurry, seats release soon" : "Seats held for you"}</span>
                    <span className={`display text-4xl ${urgent ? "text-[#b3261e]" : ""}`}>{clock}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#2a0c19]/15">
                    <div className={`h-full transition-all duration-1000 ease-linear ${urgent ? "bg-[#b3261e]" : "bg-[#2a0c19]"}`} style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="perf-h p-6">
              {chosen.length === 0 ? (
                <p className="py-4 text-sm opacity-70">Pick up to 10 seats on the map to see your total.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {chosen.map((s) => (
                      <span key={s.id} className="rounded bg-[#2a0c19] px-2 py-1 text-sm font-bold text-paper">
                        {s.id}
                      </span>
                    ))}
                  </div>
                  <dl className="mt-4 space-y-1 text-sm">
                    {regularCount > 0 && (
                      <div className="flex justify-between">
                        <dt>Regular × {regularCount}</dt>
                        <dd>₹{regularTotal}</dd>
                      </div>
                    )}
                    {premiumCount > 0 && (
                      <div className="flex justify-between">
                        <dt>Premium × {premiumCount}</dt>
                        <dd>₹{premiumTotal}</dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-[#2a0c19]/20 pt-2 text-lg font-extrabold">
                      <dt>Total</dt>
                      <dd>₹{totalAmount}</dd>
                    </div>
                  </dl>
                </>
              )}
              <div className="mt-5">{actions}</div>
            </div>
          </div>
        </aside>
      </main>

      {/* Compact bar (mobile / tablet) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-paper/10 bg-pit/95 p-4 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-md">
          {phase === "held" && (
            <div className="mb-3" role="timer" aria-label="Time left to pay">
              <div className="flex items-baseline justify-between text-sm">
                <span className={urgent ? "font-semibold text-coral" : "text-dust"}>{urgent ? "Hurry, seats release soon" : "Seats held for you"}</span>
                <span className={`display text-3xl ${urgent ? "text-coral" : "text-marquee"}`}>{clock}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-paper/15">
                <div className={`h-full transition-all duration-1000 ease-linear ${urgent ? "bg-coral" : "bg-marquee"}`} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              {chosen.length === 0 ? (
                <p className="text-sm text-dust">Pick your seats</p>
              ) : (
                <>
                  <p className="font-bold">
                    {chosen.length} {chosen.length === 1 ? "seat" : "seats"}, ₹{totalAmount}
                  </p>
                  <p className="truncate text-xs text-dust">{chosen.map((s) => s.id).join(", ")}</p>
                </>
              )}
            </div>
            {phase === "selecting" && (
              <button
                onClick={proceedToHold}
                disabled={selected.size === 0}
                className="shrink-0 rounded-full bg-marquee px-5 py-2.5 font-bold text-pit transition enabled:hover:brightness-110 disabled:opacity-40"
              >
                Hold seats
              </button>
            )}
            {phase === "held" && (
              <div className="flex shrink-0 items-center gap-3">
                <button onClick={changeSeats} className="text-sm font-semibold text-dust hover:text-paper">
                  Change
                </button>
                <button onClick={confirmBooking} className="rounded-full bg-marquee px-5 py-2.5 font-bold text-pit transition hover:brightness-110">
                  Pay ₹{totalAmount}
                </button>
              </div>
            )}
            {phase === "confirming" && (
              <span className="flex shrink-0 items-center gap-2 text-sm text-dust">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-marquee border-t-transparent" />
                Confirming…
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
