import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header/Header';
import Home from './pages/Home/Home';
import Explore from './pages/Explore/Explore';
import MyBooks from './pages/MyBooks/MyBooks';
import BookDetails from './components/BookCard/BookDetails';
import List from "./pages/List/List";
import './App.css'; // We'll keep this for reset styles

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/my-books" element={<MyBooks />} />
            <Route path="/book/:id" element={<BookDetails />} />
            <Route path="/list"      element={<List />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;