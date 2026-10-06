import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import { Home } from "./pages/Home";
import { MovieDetail } from "./pages/MovieDetail";
import { SeatSelection } from "./pages/SeatSelection";
import { MyBookings } from "./pages/MyBookings";
import { Signup } from "./pages/Signup";
import { Signin } from "./pages/Signin";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem("token");
  const location = useLocation();
  // Remember where the user was headed so sign-in can send them straight back.
  if (!token) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movies/:id" element={<MovieDetail />} />
        <Route
          path="/showtimes/:id"
          element={
            <RequireAuth>
              <SeatSelection />
            </RequireAuth>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <RequireAuth>
              <MyBookings />
            </RequireAuth>
          }
        />
        <Route path="/signup" element={<Signup />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
