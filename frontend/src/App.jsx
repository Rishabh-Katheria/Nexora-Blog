import { Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Article from "./pages/Article";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CreateArticle from "./pages/CreateArticle";
import EditArticle from "./pages/EditArticle";
import Dashboard from "./pages/Dashboard";
import ReadingList from "./pages/ReadingList";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/article/:slug" element={<Article />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/create" element={<CreateArticle />} />
        <Route path="/edit/:slug" element={<EditArticle />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reading-list" element={<ReadingList />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/u/:username" element={<PublicProfile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
