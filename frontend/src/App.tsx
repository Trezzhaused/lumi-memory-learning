import Chat from './components/Chat';
import Canvas from './components/Canvas';
import ImageUpload from './components/media/ImageUpload';
import VideoPlayer from './components/media/VideoPlayer';
import AudioPlayer from './components/media/AudioPlayer';
import Landing from './pages/Landing';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <Landing />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <Chat />
        <div className="space-y-8">
          <Canvas />
          <ImageUpload />
          <VideoPlayer />
          <AudioPlayer />
        </div>
      </div>
    </div>
  );
}
