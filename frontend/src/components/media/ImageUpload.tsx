import { useCallback, useState, type ChangeEvent, type DragEvent } from 'react';
import { useChatStore } from '../../stores/chat';

export default function ImageUpload() {
  const addMessage = useChatStore((state) => state.addMessage);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const appendImage = useCallback(
    (file: File | null) => {
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        addMessage({ role: 'user', content: `![uploaded](${dataUrl})` });
        setPreview(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [addMessage],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      appendImage(event.dataTransfer.files[0] ?? null);
    },
    [appendImage],
  );

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      appendImage(event.target.files?.[0] ?? null);
      event.target.value = '';
    },
    [appendImage],
  );

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Image upload</p>
        <h2 className="text-2xl font-semibold">Multimodal prompts</h2>
      </div>

      <div
        className={`rounded-2xl border border-dashed p-4 text-center text-sm ${isDragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700 bg-slate-950/70'}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <p className="mb-3 text-slate-300">Drop an image here or browse from disk.</p>
        <label className="inline-flex cursor-pointer rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">
          Choose image
          <input className="hidden" type="file" accept="image/*" onChange={onChange} />
        </label>
      </div>

      {preview ? (
        <img className="mt-4 h-56 w-full rounded-2xl object-cover" src={preview} alt="Uploaded preview" />
      ) : (
        <p className="mt-4 text-sm text-slate-400">Upload an image to add it to the chat context.</p>
      )}
    </section>
  );
}
